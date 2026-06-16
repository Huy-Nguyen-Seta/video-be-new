import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import { PrismaModule } from './prisma/prisma.module';
import Redis from 'ioredis';
import { RedisModule } from './redis/redis.nodule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => import('./config/configuration').then((m) => m.default)],
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                },
              }
            : undefined,
        autoLogging: true,
        redact: ['req.headers.authorization', 'res.headers.cookie'],
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.RATELIMIT_TTL ?? '60', 10) * 1000,
        limit: parseInt(process.env.RATELIMIT_MAX ?? '120', 10),
      },
    ]),
    PrismaModule,
    RedisModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
