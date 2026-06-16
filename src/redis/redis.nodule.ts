import { Module, Global } from '@nestjs/common';
import { redisClientProvider, RedisService } from './redis.service';

@Global()
@Module({
  providers: [redisClientProvider, RedisService],
  exports: [RedisService, redisClientProvider],
})
export class RedisModule {}
