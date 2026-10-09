import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import type { StorageConfig } from '../config/configuration';
import { StorageService, type UploadInput, type UploadResult } from './storage.service';

// Used for both MinIO (local) and AWS S3 (production) since MinIO implements the S3 API; switching is a config change, no code touched.
@Injectable()
export class S3StorageService extends StorageService implements OnModuleInit {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly cfg: StorageConfig;
  private readonly client: S3Client;

  constructor(config: ConfigService) {
    super();
    this.cfg = config.getOrThrow<StorageConfig>('storage');

    this.client = new S3Client({
      region: this.cfg.region,
      endpoint: this.cfg.endpoint,
      forcePathStyle: this.cfg.forcePathStyle,
      // Omitted on AWS so the SDK's default chain picks up the task/instance IAM role — no long-lived keys to leak.
      credentials:
        this.cfg.accessKeyId && this.cfg.secretAccessKey
          ? {
              accessKeyId: this.cfg.accessKeyId,
              secretAccessKey: this.cfg.secretAccessKey,
            }
          : undefined,
    });
  }

  async onModuleInit(): Promise<void> {
    if (this.cfg.driver !== 'minio') {
      return;
    }
    // Local convenience only; must not stop the API booting if MinIO isn't up yet.
    for (const [bucket, isPublic] of [
      [this.cfg.bucket, true],
      [this.cfg.privateBucket, false],
    ] as const) {
      try {
        await this.ensureBucket(bucket, isPublic);
      } catch (error) {
        this.logger.warn(
          `MinIO bucket "${bucket}" not ready: ${describe(error)}. Uploads will fail until MinIO is reachable.`,
        );
      }
    }
  }

  async upload(input: UploadInput): Promise<UploadResult> {
    if (input.buffer.byteLength > this.cfg.maxBytes) {
      throw new Error(`File exceeds the ${this.cfg.maxBytes} byte limit`);
    }

    const key = this.buildKey(input);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.mimeType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    return {
      key,
      url: this.getUrl(key),
      size: input.buffer.byteLength,
      mimeType: input.mimeType,
    };
  }

  getUrl(key: string): string {
    return `${this.cfg.publicUrl}/${key}`;
  }

  getSignedUrl(key: string, expiresInSeconds = 900): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }));
  }

  async uploadPrivate(input: UploadInput): Promise<Omit<UploadResult, 'url'>> {
    const key = this.buildKey(input);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.cfg.privateBucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.mimeType,
        CacheControl: 'private, max-age=0, no-store',
      }),
    );

    return { key, size: input.buffer.byteLength, mimeType: input.mimeType };
  }

  getPrivateDownloadUrl(key: string, fileName: string, expiresInSeconds = 600): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.cfg.privateBucket,
        Key: key,
        ResponseContentDisposition: contentDisposition(fileName),
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  async deletePrivate(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.cfg.privateBucket, Key: key }));
  }

  // The client's filename never reaches the key — it's attacker-controlled and could otherwise enable path traversal or overwrite another object.
  private buildKey(input: UploadInput): string {
    const extension = extname(input.filename).toLowerCase().slice(0, 10);
    const folder = (input.folder ?? 'uploads').replace(/[^a-z0-9/_-]/gi, '');
    return `${folder}/${randomUUID()}${extension}`;
  }

  private async ensureBucket(bucket: string, isPublic: boolean): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
      return;
    } catch {
      // Missing or unreachable — try to create it below.
    }

    await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
    if (!isPublic) {
      this.logger.log(`Created private MinIO bucket "${bucket}"`);
      return;
    }
    await this.client.send(
      new PutBucketPolicyCommand({
        Bucket: bucket,
        Policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${bucket}/*`],
            },
          ],
        }),
      }),
    );
    this.logger.log(`Created MinIO bucket "${bucket}" with public read access`);
  }
}

// ASCII fallback in filename= for old clients, the real (possibly non-ASCII) name in filename* (RFC 6266).
const contentDisposition = (fileName: string): string => {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
};

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
