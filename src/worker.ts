import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { REDIS_CLIENT } from './redis/redis.service';
import { VideosService } from './modules/videos/videos.service';
import { StorageService } from './modules/storage/storage.service';
import Redis from 'ioredis';
import { ConnectionOptions, Worker } from 'bullmq';
import {
  VIDEO_QUEUE,
  VideoProcessingJob,
} from './modules/queue/queue.contants';
import { processVideoJob } from './modules/queue/video.processor';

async function bootstrap() {
  const logger = new Logger('Worker');
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: false,
  });
  app.enableShutdownHooks();
  const connection = app.get<Redis>(REDIS_CLIENT);
  const videos = app.get(VideosService);
  const storage = app.get(StorageService);
  const worker = new Worker<VideoProcessingJob>(
    VIDEO_QUEUE,
    (job) => processVideoJob(job, { videos, storage }),
    {
      connection: connection as unknown as ConnectionOptions,
      concurrency: 3,
    },
  );
  worker.on('completed', (job) => {
    logger.log(`Job ${job.id} completed`);
  });
  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed: ${err.message}`);
  });

  const shutdown = async () => {
    logger.log('Shutting down worker...');
    await worker.close();
    await app.close();
    logger.log('Worker shutdown complete');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap();
