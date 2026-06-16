import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';
import { Public } from './common/decorators/public.decorator';
import { RedisService } from './redis/redis.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  health() {
    return { status: 'ok' };
  }

  @Public()
  @Get('health/ready')
  @ApiOperation({ summary: 'Readiness check endpoint' })
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.redis.client.ping();
      return { status: 'ready' };
    } catch (error) {
      return { status: 'not ready', error: error.message };
    }
  }
}
