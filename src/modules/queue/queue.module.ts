import { Module } from '@nestjs/common';
import { VideoProducer } from './video.producer';

@Module({
  providers: [VideoProducer],
  exports: [VideoProducer],
})
export class QueueModule {}
