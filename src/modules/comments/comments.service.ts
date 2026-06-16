import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from 'src/common/decorators/current-user.decorator';
import { PrismaService } from 'src/prisma/prisma.service';
import sanitizeHtml from 'sanitize-html';
import {
  bildPageMeta,
  PaginationQueryDto,
} from 'src/common/dto/paginnation.dto';
import { Role } from '@prisma/client';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}
  async create(
    user: AuthUser,
    videoId: string,
    content: string,
    parentId?: string,
  ) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
    });
    if (!video) throw new NotFoundException('Video not found');
    if (parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: parentId },
      });
      if (!parent || parent.videoId !== videoId) {
        throw new BadRequestException('Invalid parent comment');
      }
      if (parent?.parentId) parentId = parent.parentId;
    }
    return this.prisma.comment.create({
      data: {
        content: this.clean(content),
        videoId,
        userId: user.id,
        parentId,
      },
      include: { user: { select: { id: true, name: true, avataUrl: true } } },
    });
  }

  async listForVideo(videoId: string, query: PaginationQueryDto) {
    const where = { videoId, parentId: null };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        orderBy: { createdAt: query.order },
        skip: query.skip,
        take: query.limit,
        include: {
          user: { select: { id: true, name: true, avataUrl: true } },
          replies: {
            orderBy: { createdAt: 'asc' },
            include: {
              user: { select: { id: true, name: true, avataUrl: true } },
            },
          },
        },
      }),
      this.prisma.comment.count({ where }),
    ]);
    return { items, meta: bildPageMeta(query.page, query.limit, total) };
  }
  async update(user: AuthUser, commentId: string, content: string) {
    const comment = await this.assertOwnerOrAdmin(user, commentId);
    return this.prisma.comment.update({
      where: { id: comment.id },
      data: { content: this.clean(content) },
      include: {
        user: { select: { id: true, name: true, avataUrl: true } },
      },
    });
  }

  async remove(user: AuthUser, commentId: string) {
    const comment = await this.assertOwnerOrAdmin(user, commentId);
    await this.prisma.comment.delete({ where: { id: comment.id } });
    return { success: true };
  }

  async assertOwnerOrAdmin(user: AuthUser, commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== user.id && user.role !== Role.ADMIN) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }

  private clean(content: string): string {
    return sanitizeHtml(content, {
      allowedTags: [],
      allowedAttributes: {},
    }).trim();
  }
}
