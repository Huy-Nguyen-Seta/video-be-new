import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.nodule';
import { AuthModule } from './modules/auth/auth.module';
import configuration from './config/configuration';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JWTAuthGuard } from './common/gruards/jwt-auth.gruad';
import { RolesGuard } from './common/gruards/roles.gruad';
import { AllExceptionsFilter } from './common/filters/all-exceptions.fillter';
import { TranformInterceptor } from './common/interceptors/transform.interceptor';
import { StorageModule } from './modules/storage/storage.module';
import { UsersModule } from './modules/users/users.module';
import { QueueModule } from './modules/queue/queue.module';
import { VideosModule } from './modules/videos/videos.module';
import { CommentsModule } from './modules/comments/comments.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
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
    AuthModule,
    StorageModule,
    UsersModule,
    QueueModule,
    VideosModule,
    CommentsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JWTAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TranformInterceptor },
  ],
})
export class AppModule {}
