import { Module } from '@nestjs/common';
import { VideosService } from './videos.service';
import { QueueModule } from '../queue/queue.module';
import { VideosController } from './videos.controller';

@Module({
  imports: [QueueModule],
  controllers: [VideosController],
  providers: [VideosService],
  exports: [VideosService],
})
export class VideosModule {}
