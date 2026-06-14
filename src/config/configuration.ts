export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigin: string[];
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  redis: {
    host: string;
    port: number;
  };
  minio: {
    endPoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    bucket: string;
    publicUrl: string;
  };
  ratelimit: {
    ttl: number;
    max: number;
  };
  hotVideoCacheTtl: number;
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'default_access_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'default_refresh_secret',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '900s',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10) || 6379,
  },
  minio: {
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT ?? '9000', 10) || 9000,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || 'videos',
    publicUrl: process.env.MINIO_PUBLIC_URL || 'http://localhost:9000',
  },
  ratelimit: {
    ttl: parseInt(process.env.RATELIMIT_TTL ?? '60', 10) || 60,
    max: parseInt(process.env.RATELIMIT_MAX ?? '120', 10) || 100,
  },
  hotVideoCacheTtl: parseInt(process.env.HOT_VIDEO_CACHE_TTL ?? '60', 10) || 60,
});
