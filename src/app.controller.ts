import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';
import { Public } from './common/decorators/public.decorator';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

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
      return { status: 'ready' };
    } catch (error) {
      return { status: 'not ready', error: error.message };
    }
  }
}
