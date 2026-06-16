import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import * as bcrypt from 'bcryptjs';
const AVATE_MINE = ['image/jpeg', 'image/png', 'image/webp'];
const AVATA_MAX_BYTES = 2 * 1024 * 1024; // 2MB

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.sanitize(user);
  }

  async updateProfile(userId: string, data: { name?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    return this.sanitize(user);
  }

  async changePassword(
    userId: string,
    currentPasswordHash: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!(await bcrypt.compare(currentPasswordHash, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await this.prisma.refeshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async updateAvatar(
    userId: string,
    file?: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    },
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (!AVATE_MINE.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type');
    }
    if (file.size > AVATA_MAX_BYTES) {
      throw new BadRequestException('File too large');
    }
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    const { url } = await this.storage.uploadFile(file, `avatars/${userId}`);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avataUrl: url },
    });
    if (current?.avataUrl) {
      void this.storage.remove(
        this.storage.keyFromUrl(current.avataUrl) || null,
      );
    }
    return this.sanitize(user);
  }

  private sanitize(user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safeInfo } = user;
    return safeInfo;
  }
}
