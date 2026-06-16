import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ValidationPipe, VersioningType } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const config = app.get(ConfigService);
  app.useLogger(app.get(Logger));
  app.set('trust proxy', 1);
  app.enableShutdownHooks();
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.get<string>('corsOrigins'),
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  // const swaggerConfig = new DocumentBuilder()
  //   .setTitle('Video API')
  //   .setDescription('API documentation for the Video application')
  //   .setVersion('1.0')
  //   .addBearerAuth()
  //   .build();
  // const document = SwaggerModule.createDocument(app, swaggerConfig);
  // SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('port') || 3000;

  await app.listen(port ?? 3000);
  // app.get(Logger).log(`Api run on ${port}`);
}
bootstrap();
