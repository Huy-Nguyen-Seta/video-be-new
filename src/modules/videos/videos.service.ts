import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/redis/redis.service';
import { StorageService } from '../storage/storage.service';
import { VideoProducer } from '../queue/video.producer';
import { ConfigService } from '@nestjs/config';
import { AuthUser } from 'src/common/decorators/current-user.decorator';
import { UpdateVideoDto } from './dto/update-video.dto';
import { Role, VideoStatus, Prisma } from '@prisma/client';
import { QueryVideoDto } from './dto/query-video.dto';
import { CreateVideoDto } from './dto/create-video.dto';
import { bildPageMeta, PaginatedResult } from 'src/common/dto/paginnation.dto';

const VIDEO_MINE = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB
const LIST_CACHE_PREFIX = 'videos:list';
const HOT_CACHE_KEY = 'videos:hot';
const PENDING_VIEW_PREFIX = 'videos:pending:';
const SEEN_VIEW_PREFIX = 'videos:seen:';
const VIEW_DEDUPE_TTL = 30 * 60;
const VIEW_FLUSH_INTERVAL = 10_000;
const LIST_CACHE_TTL = 30;

@Injectable()
export class VideosService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VideosService.name);
  private flushTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly videoProducer: VideoProducer,
    private readonly cache: RedisService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (process.env.ENABLE_VIEW_FLUSHER === 'true') {
      this.flushTimer = setInterval(
        () => void this.flushPendingViews(),
        VIEW_FLUSH_INTERVAL,
      );
      this.logger.log('View flusher enabled');
    }
  }

  onModuleDestroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.logger.log('View flusher stopped');
    }
  }
  async create(user: AuthUser, dto: CreateVideoDto, file: Express.Multer.File) {
    this.assertVideoFile(file);
    const { key } = await this.storage.uploadFile(file, `videos/${user.id}`);
    const video = await this.prisma.video.create({
      data: {
        title: dto.title,
        description: dto.description,
        originalKey: key,
        ownerId: user.id,
        status: VideoStatus.PROCESSING,
      },
    });
    await this.videoProducer.endqueueProcessing({
      videoId: video.id,
      originalKey: key,
    });
    this.invalidateListCaches();
    return video;
  }

  async findAll(query: QueryVideoDto) {
    const cacheKey = `${LIST_CACHE_PREFIX}${this.cacheKeyFor(query)}`;
    const cached = await this.cache.getJson<PaginatedResult<unknown>>(cacheKey);
    if (cached) return cached;
    const where: Prisma.VideoWhereInput = {};
    if (query.search)
      where.title = { contains: query.search, mode: 'insensitive' };
    if (query.status) where.status = query.status;
    if (query.ownerId) where.ownerId = query.ownerId;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.video.findMany({
        where,
        orderBy: { [query.sortBy]: query.order },
        skip: query.skip,
        take: query.limit,
        include: {
          owner: { select: { id: true, name: true, avataUrl: true } },
        },
      }),
      this.prisma.video.count({ where }),
    ]);
    const result: PaginatedResult<unknown> = {
      items,
      meta: bildPageMeta(query.page, query.limit, total),
    };
    await this.cache.setJson(cacheKey, result, LIST_CACHE_TTL);
    return result;
  }
  async findHot(limit = 10) {
    const cached = await this.cache.getJson<unknown[]>(HOT_CACHE_KEY);
    if (cached) return cached;
    const videos = await this.prisma.video.findMany({
      where: { status: VideoStatus.READY },
      orderBy: { viewCount: 'desc' },
      take: limit,
      include: {
        owner: { select: { id: true, name: true, avataUrl: true } },
      },
    });
    await this.cache.setJson(
      HOT_CACHE_KEY,
      videos,
      this.config.get<number>('hotVideoCacheTtl'),
    );
    return videos;
  }

  async findOne(id: string) {
    const video = await this.prisma.video.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, avataUrl: true } },
      },
    });
    if (!video) throw new NotFoundException('Video not found');
    const pending =
      Number(await this.cache.client.get(`${PENDING_VIEW_PREFIX}${id}`)) || 0;
    return { ...video, viewsCount: video.viewCount + pending };
  }

  async incrementViewCount(videoId: string, viewerKey?: string) {
    const seenKey = `${SEEN_VIEW_PREFIX}${viewerKey}:${videoId}`;
    const first = await this.cache.client.set(
      seenKey,
      '1',
      'EX',
      VIEW_DEDUPE_TTL,
      'NX',
    );
    if (first !== 'OK') return { counted: false };
    await this.cache.client.incr(`${PENDING_VIEW_PREFIX}${videoId}`);
    return { counted: true };
  }

  async update(user: AuthUser, id: string, dto: UpdateVideoDto) {
    await this.assertOwnerOrAdmin(user, id);
    const video = await this.prisma.video.update({
      where: { id },
      data: dto,
    });
    this.invalidateListCaches();
    return video;
  }

  async remove(user: AuthUser, id: string) {
    const video = await this.assertOwnerOrAdmin(user, id);
    await this.prisma.video.delete({ where: { id } });
    await this.storage.remove(video.originalKey);
    this.invalidateListCaches();
    return { success: true };
  }

  async markReady(
    videoId: string,
    data: { thumbnailUrl: string; playbackUrl: string; durationSec: number },
  ) {
    const video = await this.prisma.video.update({
      where: { id: videoId },
      data: { ...data, status: VideoStatus.READY },
    });
    await this.invalidateListCaches();
    return video;
  }

  private async assertOwnerOrAdmin(user: AuthUser, videoId: string) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
    });
    if (!video) throw new NotFoundException('Video not found');
    if (video.ownerId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Not owner this video');
    }
    return video;
  }

  async markFailed(videoId: string) {
    await this.prisma.video.update({
      where: { id: videoId },
      data: { status: VideoStatus.FAILED },
    });
  }

  private async invalidateListCaches() {
    return Promise.all([
      this.cache.delByPattern(`${LIST_CACHE_PREFIX}:*`),
      this.cache.del(HOT_CACHE_KEY),
    ]);
  }

  private assertVideoFile(file?: Express.Multer.File): asserts file {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (!VIDEO_MINE.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File too large');
    }
  }

  private cacheKeyFor(query: QueryVideoDto): string {
    return [
      query.page,
      query.limit,
      query.order,
      query.sortBy,
      query.search ?? '',
      query.status ?? '',
      query.ownerId ?? '',
    ].join(':');
  }
  private async flushPendingViews() {
    const client = this.cache.client;
    const updates: { id: string; delta: number }[] = [];
    const stream = client.scanStream({
      match: `${PENDING_VIEW_PREFIX}*`,
      count: 100,
    });
    for await (const keys of stream) {
      for (const key of keys as string[]) {
        const delta = Number(await client.getdel(key));
        if (delta > 0) {
          updates.push({ id: key.slice(PENDING_VIEW_PREFIX.length), delta });
        }
      }
    }
    if (!updates.length) return;
    await Promise.all(
      updates.map((u) =>
        this.prisma.video.updateMany({
          where: { id: u.id },
          data: { viewCount: { increment: u.delta } },
        }),
      ),
    );
    await this.cache.del(HOT_CACHE_KEY);
    this.logger.debug(`Flushed ${updates.length} video view updates`);
  }
}
