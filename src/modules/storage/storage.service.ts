import { OnModuleInit, Logger, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Client as MinioClient } from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: MinioClient;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('minio.bucket')!;
    this.publicUrl = this.config.get<string>('minio.publicUrl')!;
    this.client = new MinioClient({
      endPoint: this.config.get<string>('minio.endPoint')!,
      port: this.config.get<number>('minio.port')!,
      useSSL: this.config.get<boolean>('minio.useSSL')!,
      accessKey: this.config.get<string>('minio.accessKey')!,
      secretKey: this.config.get<string>('minio.secretKey')!,
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        await this.client.setBucketPolicy(this.bucket, this.publicReadPolicy());
      }
    } catch (error) {
      this.logger.error(
        `Failed to initialize Minio bucket: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async uploadFile(
    file: { buffer: Buffer; mimetype: string; originalname: string },
    prefix: string,
  ): Promise<{ key: string; url: string }> {
    const ext = file.originalname.includes('.')
      ? file.originalname.split('.').pop()
      : 'bin';
    const key = `${prefix}/${randomUUID()}.${ext}`;
    await this.client.putObject(
      this.bucket,
      key,
      file.buffer,
      file.buffer.length,
      {
        'Content-Type': file.mimetype,
      },
    );
    return { key, url: this.urlFor(key) };
  }

  async remove(key: string | null): Promise<void> {
    if (!key) return;
    try {
      await this.client.removeObject(this.bucket, key);
    } catch (error) {
      this.logger.error(
        `Failed to remove object ${key} from Minio: ${(error as Error).message}`,
      );
    }
  }

  keyFromUrl(url: string): string | null | undefined {
    if (!url) return undefined;
    return url.split(`/${this.bucket}/`)[1];
  }

  private publicReadPolicy(): string {
    return JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${this.bucket}/*`],
        },
      ],
    });
  }
  public urlFor(key: string): string {
    return `${this.publicUrl}/${this.bucket}/${key}`;
  }
}
