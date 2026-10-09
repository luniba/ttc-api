import { Global, Module } from '@nestjs/common';
import { S3StorageService } from './s3-storage.service';
import { StorageService } from './storage.service';

// MinIO and AWS S3 share the S3 API, so both are served by S3StorageService and selected by env alone.
@Global()
@Module({
  providers: [{ provide: StorageService, useClass: S3StorageService }],
  exports: [StorageService],
})
export class StorageModule {}
