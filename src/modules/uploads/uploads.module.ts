import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';

// StorageService comes from the global StorageModule.
@Module({
  controllers: [UploadsController],
})
export class UploadsModule {}
