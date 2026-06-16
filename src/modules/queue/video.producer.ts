import { Inject, OnModuleDestroy } from '@nestjs/common';
import { VIDEO_QUEUE, VideoProcessingJob } from './queue.contants';
import { REDIS_CLIENT } from 'src/redis/redis.service';
import { ConnectionOptions } from 'tls';
import Redis from 'ioredis';
import { Queue } from 'bullmq';

export class VideoProducer implements OnModuleDestroy {
  private readonly queue: Queue<VideoProcessingJob>;
  constructor(@Inject(REDIS_CLIENT) connection: Redis) {
    this.queue = new Queue<VideoProcessingJob>(VIDEO_QUEUE, {
      connection: connection as unknown as ConnectionOptions,
    });
  }
  async endqueueProcessing(job: VideoProcessingJob): Promise<void> {
    await this.queue.add('process', job, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }
  async onModuleDestroy() {
    await this.queue.close();
  }
}
