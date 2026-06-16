import { Logger } from '@nestjs/common';
import { VideosService } from '../videos/videos.service';
import { VideoProcessingJob } from './queue.contants';
import { StorageService } from '../storage/storage.service';
import { Job } from 'bullmq';

const logger = new Logger('VideoProcessor');

export async function processVideoJob(
  job: Job<VideoProcessingJob>,
  deps: { videos: VideosService; storage: StorageService },
): Promise<void> {
  const { videoId, originalKey } = job.data;
  logger.log(`Processing video ${videoId} with key ${originalKey}`);
  try {
    await job.updateProgress(10);
    await delay(1500);
    await job.updateProgress(60);
    await delay(1000);

    const thumbnailUrl = `https://picsum.photos/seed/${videoId}/640/360`;
    const playbackUrl = deps.storage.urlFor(originalKey);
    await deps.videos.markReady(videoId, {
      thumbnailUrl,
      playbackUrl,
      durationSec: 30 + Math.floor(Math.random() * 300),
    });
    await job.updateProgress(100);
    logger.log(`Video ${videoId} processed successfully`);
  } catch (error) {
    logger.error(
      `Failed to process video ${videoId}: ${(error as Error).message}`,
    );
    await deps.videos.markFailed(videoId);
    throw error;
  }
}

const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
