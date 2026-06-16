import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) public readonly client: Redis) {}
  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async setJson(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<void> {
    const payload = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.set(key, payload, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, payload);
    }
  }

  async del(...key: string[]): Promise<void> {
    if (key.length) await this.client.del(...key);
  }

  async delByPattern(pattern: string): Promise<void> {
    const stream = await this.client.scanStream({ match: pattern, count: 100 });
    const pipline = this.client.pipeline();
    let found = false;
    for await (const keys of stream) {
      for (const key of keys) {
        pipline.del(key);
        found = true;
      }
    }
    if (found) await pipline.exec();
  }
  onModuleDestroy() {
    this.client.disconnect();
  }
}

export const redisClientProvider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    return new Redis({
      host: config.get<string>('redis.host'),
      port: config.get<number>('redis.port'),
      maxRetriesPerRequest: null,
    });
  },
};
