import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { detectImageFormat } from '../../common/utils/image-signature';
import type { StorageConfig } from '../../config/configuration';
import { StorageService } from '../../storage/storage.service';
import { STAFF_ROLES } from '../users/entities/user.entity';

/** Image types we accept. Anything else is rejected before it reaches storage. */
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

@ApiTags('uploads')
@ApiBearerAuth('access-token')
@Roles(...STAFF_ROLES)
@Controller('uploads')
export class UploadsController {
  private readonly maxBytes: number;

  constructor(
    private readonly storage: StorageService,
    config: ConfigService,
  ) {
    this.maxBytes = config.getOrThrow<StorageConfig>('storage').maxBytes;
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload an image (admin)',
    description:
      'Returns a storage key and a URL. Persist the **key** on the owning record — the URL is derived and may change.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({
    schema: {
      example: {
        success: true,
        data: {
          key: 'uploads/7f3a....webp',
          url: 'http://localhost:9004/lms/uploads/7f3a....webp',
          size: 84213,
          mimeType: 'image/webp',
        },
      },
    },
  })
  async upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded (field name must be "file")',
      );
    }

    // Cheap rejections first — no point sniffing bytes we are going to refuse.
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported type "${file.mimetype}". Allowed: ${[...ALLOWED_MIME].join(', ')}`,
      );
    }

    if (file.size > this.maxBytes) {
      throw new BadRequestException(
        `File is ${file.size} bytes; the limit is ${this.maxBytes}`,
      );
    }

    // The declared Content-Type is the client's claim; the magic bytes are the evidence (see image-signature.ts).
    const actual = detectImageFormat(file.buffer);

    if (!actual) {
      throw new BadRequestException(
        'File content is not a recognisable image. The declared type does not match the actual bytes.',
      );
    }

    if (!ALLOWED_MIME.has(actual)) {
      throw new BadRequestException(
        `File content is "${actual}", which is not allowed. Allowed: ${[...ALLOWED_MIME].join(', ')}`,
      );
    }

    return this.storage.upload({
      buffer: file.buffer,
      filename: file.originalname,
      // Store the sniffed type, never the claimed one.
      mimeType: actual,
    });
  }
}
