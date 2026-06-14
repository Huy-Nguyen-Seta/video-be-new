import { plainToInstance } from 'class-transformer';
import { IsIn, IsOptional, IsString, validateSync } from 'class-validator';

class EnvVar {
  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  REDIS_HOST!: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvVar, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      `Config validation error: ${errors.map((e) => Object.values(e.constraints || {}).join(', ')).join('; ')}`,
    );
  }
  return config;
}
