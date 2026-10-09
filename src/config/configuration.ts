// Single source of truth for configuration: every env var is read exactly once, here. Shape validation lives in ./env.validation.ts.

export type NodeEnv = 'development' | 'production' | 'test';
export type SameSite = 'lax' | 'strict' | 'none';
export type StorageDriver = 'minio' | 's3';

export interface AppConfig {
  env: NodeEnv;
  isProduction: boolean;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
  // CORS_ORIGINS=* accepts any origin by reflecting it back (a literal `*` is illegal with credentials). Dev-only; refused in production.
  corsAllowAll: boolean;
  frontendUrl: string;
  backendUrl: string;
  // Blanket per-IP ceiling only; configurable so test suites (all requests from one IP) don't throttle themselves.
  throttleTtlMs: number;
  throttleLimit: number;
}

export interface DatabaseConfig {
  url: string;
  ssl: boolean;
}

export interface RedisConfig {
  url: string;
}

export interface CookieConfig {
  secure: boolean;
  sameSite: SameSite;
  domain?: string;
  /** Scopes the refresh cookie to the auth routes so it is not sent elsewhere. */
  refreshPath: string;
}

export interface AuthConfig {
  accessSecret: string;
  accessExpiresIn: string;
  refreshTtlDays: number;
  resetTtlMinutes: number;
  verifyTtlHours: number;
  bcryptRounds: number;
  requireEmailVerified: boolean;
  cookie: CookieConfig;
}

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  successRedirect: string;
  enabled: boolean;
}

export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export interface StorageConfig {
  driver: StorageDriver;
  bucket: string;
  // No public-read policy: paid content (course materials), reachable only through short-lived signed URLs.
  privateBucket: string;
  region: string;
  /** Custom S3 endpoint (MinIO). Undefined for real AWS S3. */
  endpoint?: string;
  /** MinIO needs path-style addressing; AWS S3 uses virtual-host style. */
  forcePathStyle: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicUrl: string;
  maxBytes: number;
}

export interface RecaptchaConfig {
  secret: string;
  minScore: number;
  enabled: boolean;
}

export interface AdminSeedConfig {
  email: string;
  password: string;
  name: string;
}

export interface Configuration {
  app: AppConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  auth: AuthConfig;
  google: GoogleConfig;
  mail: MailConfig;
  storage: StorageConfig;
  recaptcha: RecaptchaConfig;
  adminSeed: AdminSeedConfig;
}

const bool = (value: string | undefined, fallback = false): boolean =>
  value === undefined || value === '' ? fallback : value === 'true';

const int = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const float = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Trailing slashes break URL building and OAuth redirect matching. */
const trimUrl = (value: string): string => value.replace(/\/+$/, '');

export default (): Configuration => {
  const env = (process.env.NODE_ENV ?? 'development') as NodeEnv;
  const isProduction = env === 'production';

  // Normalised to "/api" whether the env says "api" or "/api" — the refresh-cookie path and log/docs URLs are built by concatenation.
  const prefixSegment = (process.env.API_PREFIX ?? '').replace(/^\/+|\/+$/g, '');
  const apiPrefix = prefixSegment ? `/${prefixSegment}` : '';
  const frontendUrl = trimUrl(process.env.FRONTEND_URL ?? 'http://localhost:3000');
  const backendUrl = trimUrl(process.env.BACKEND_URL ?? 'http://localhost:5010');

  const driver = (process.env.STORAGE_DRIVER ?? 'minio') as StorageDriver;
  const bucket = process.env.STORAGE_BUCKET ?? 'lms';
  const isMinio = driver === 'minio';

  return {
    app: {
      env,
      isProduction,
      port: int(process.env.PORT, 5010),
      apiPrefix,
      corsOrigins: (process.env.CORS_ORIGINS ?? frontendUrl)
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin && origin !== '*'),
      corsAllowAll: (process.env.CORS_ORIGINS ?? '')
        .split(',')
        .some((origin) => origin.trim() === '*'),
      frontendUrl,
      backendUrl,
      throttleTtlMs: int(process.env.THROTTLE_TTL_MS, 60_000),
      throttleLimit: int(process.env.THROTTLE_LIMIT, 100),
    },

    database: {
      url: process.env.DATABASE_URL as string,
      ssl: bool(process.env.DATABASE_SSL),
    },

    redis: {
      url: process.env.REDIS_URL ?? 'redis://localhost:6379',
    },

    auth: {
      accessSecret: process.env.JWT_ACCESS_SECRET as string,
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      refreshTtlDays: int(process.env.REFRESH_TOKEN_TTL_DAYS, 7),
      resetTtlMinutes: int(process.env.PASSWORD_RESET_TTL_MIN, 60),
      verifyTtlHours: int(process.env.EMAIL_VERIFY_TTL_HOURS, 24),
      bcryptRounds: int(process.env.BCRYPT_SALT_ROUNDS, 12),
      requireEmailVerified: bool(process.env.REQUIRE_EMAIL_VERIFIED, true),
      cookie: {
        // Never ship non-secure cookies in production, whatever the env says.
        secure: bool(process.env.COOKIE_SECURE) || isProduction,
        sameSite: (process.env.COOKIE_SAMESITE ?? 'lax') as SameSite,
        domain: process.env.COOKIE_DOMAIN || undefined,
        refreshPath: `${apiPrefix}/auth`,
      },
    },

    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      callbackUrl:
        process.env.GOOGLE_CALLBACK_URL ?? `${backendUrl}${apiPrefix}/auth/google/callback`,
      successRedirect: process.env.GOOGLE_SUCCESS_REDIRECT ?? `${frontendUrl}/auth/callback`,
      enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },

    mail: {
      host: process.env.SMTP_HOST ?? '',
      port: int(process.env.SMTP_PORT, 1026),
      secure: bool(process.env.SMTP_SECURE),
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASS ?? '',
      from: process.env.MAIL_FROM ?? 'TESOL TEFL Council <no-reply@lms.local>',
    },

    storage: {
      driver,
      bucket,
      privateBucket: process.env.STORAGE_PRIVATE_BUCKET || 'lms-private',
      region: isMinio ? 'us-east-1' : (process.env.AWS_REGION ?? 'ap-south-1'),
      endpoint: isMinio ? (process.env.MINIO_ENDPOINT ?? 'http://localhost:9000') : undefined,
      forcePathStyle: isMinio,
      // Left undefined on AWS so the SDK falls back to the instance/task IAM role.
      accessKeyId: isMinio
        ? (process.env.MINIO_ACCESS_KEY ?? 'minioadmin')
        : process.env.AWS_ACCESS_KEY_ID || undefined,
      secretAccessKey: isMinio
        ? (process.env.MINIO_SECRET_KEY ?? 'minioadmin')
        : process.env.AWS_SECRET_ACCESS_KEY || undefined,
      publicUrl: isMinio
        ? `${trimUrl(process.env.MINIO_PUBLIC_URL ?? 'http://localhost:9000')}/${bucket}`
        : trimUrl(
            process.env.S3_PUBLIC_URL ||
              `https://${bucket}.s3.${process.env.AWS_REGION ?? 'ap-south-1'}.amazonaws.com`,
          ),
      maxBytes: int(process.env.UPLOAD_MAX_BYTES, 10 * 1024 * 1024),
    },

    recaptcha: {
      secret: process.env.RECAPTCHA_SECRET ?? '',
      minScore: float(process.env.RECAPTCHA_MIN_SCORE, 0.5),
      enabled: !!process.env.RECAPTCHA_SECRET,
    },

    adminSeed: {
      email: process.env.ADMIN_EMAIL ?? '',
      password: process.env.ADMIN_PASSWORD ?? '',
      name: process.env.ADMIN_NAME ?? 'Admin',
    },
  };
};
