import { plainToInstance } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';
import { Type } from 'class-transformer';

// Boot-time validation for vars that must never be silently wrong; optional integrations (Google, SMTP, reCAPTCHA) degrade gracefully instead.
enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV!: Environment;

  @Type(() => Number)
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT?: number;

  // A short secret makes the HS256 signature brute-forceable, so this is a
  // hard failure rather than a warning.
  @IsString()
  @MinLength(32, {
    message: 'JWT_ACCESS_SECRET must be at least 32 characters. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
  })
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL!: string;

  @IsUrl({ require_tld: false })
  FRONTEND_URL!: string;

  @IsUrl({ require_tld: false })
  BACKEND_URL!: string;

  @IsOptional()
  @IsBooleanString()
  DATABASE_SSL?: string;

  @IsOptional()
  @IsBooleanString()
  COOKIE_SECURE?: string;

  @IsOptional()
  @IsIn(['lax', 'strict', 'none'])
  COOKIE_SAMESITE?: string;

  @IsOptional()
  @IsIn(['minio', 's3'])
  STORAGE_DRIVER?: string;

  @IsOptional()
  @IsString()
  STORAGE_PRIVATE_BUCKET?: string;

  @Type(() => Number)
  @IsOptional()
  @Min(4)
  @Max(15)
  BCRYPT_SALT_ROUNDS?: number;
}

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const parsed = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(parsed, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('\n  - ');
    throw new Error(`Invalid environment configuration:\n  - ${details}`);
  }

  // Browsers silently drop cross-site cookies without Secure, which would look like a broken login rather than a config bug.
  if (config.COOKIE_SAMESITE === 'none' && config.COOKIE_SECURE !== 'true') {
    throw new Error('Invalid environment configuration:\n  - COOKIE_SAMESITE=none requires COOKIE_SECURE=true');
  }

  // Sharing the public bucket would put paid material files behind its public-read policy.
  if ((config.STORAGE_PRIVATE_BUCKET || 'lms-private') === (config.STORAGE_BUCKET || 'lms')) {
    throw new Error('Invalid environment configuration:\n  - STORAGE_PRIVATE_BUCKET must differ from STORAGE_BUCKET');
  }

  const corsAllowAll =
    typeof config.CORS_ORIGINS === 'string' &&
    config.CORS_ORIGINS.split(',').some((origin) => origin.trim() === '*');

  if (config.NODE_ENV === 'production') {
    if (config.COOKIE_SECURE === 'false') {
      throw new Error('Invalid environment configuration:\n  - COOKIE_SECURE must be true in production');
    }

    // Reflection means any site could make credentialed requests on a user's behalf — fine on localhost, never in production.
    if (corsAllowAll) {
      throw new Error('Invalid environment configuration:\n  - CORS_ORIGINS cannot be "*" in production. It reflects every origin, letting any site make credentialed requests. List exact origins.');
    }
    if (!config.RECAPTCHA_SECRET) {
      // Loud, but not fatal: some deployments front the API with a WAF instead.
      console.warn('[env] RECAPTCHA_SECRET is not set — captcha verification is disabled in production.');
    }
  }

  return config;
}
