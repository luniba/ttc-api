import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import type { MaterialDto } from './courses.mappers';
import { CreateLinkMaterialDto, UploadFileMaterialDto } from './dto/material.dto';
import { ModulesService } from './modules.service';

const MATERIAL_MAX_BYTES = 50 * 1024 * 1024;

@ApiTags('admin: course materials')
@ApiBearerAuth('access-token')
@ApiForbiddenResponse({ description: 'Caller is not an admin.' })
@Roles(UserRole.ADMIN)
@Controller('admin')
export class MaterialsAdminController {
  constructor(private readonly modules: ModulesService) {}

  @Post('modules/:moduleId/materials/file')
  // Memory storage; multer aborts past the limit (→ 413) before buffering more. utf8 so non-ASCII file names survive.
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MATERIAL_MAX_BYTES, files: 1 }, defParamCharset: 'utf8' }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a file material (PDF, Word, PowerPoint; ≤ 50 MB)',
    description: 'Type is checked by magic bytes against the extension. Stored privately; returned `url` is signed (~10 min).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' }, title: { type: 'string', maxLength: 200 } },
      required: ['file'],
    },
  })
  @ApiUnsupportedMediaTypeResponse({ description: 'UNSUPPORTED_MEDIA_TYPE' })
  @ApiPayloadTooLargeResponse({ description: 'Over 50 MB.' })
  uploadFile(
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() dto: UploadFileMaterialDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<MaterialDto> {
    if (!file) throw new BadRequestException('No file uploaded (field name must be "file")');
    return this.modules.addFile(moduleId, file, dto.title);
  }

  @Post('modules/:moduleId/materials/link')
  @ApiOperation({ summary: 'Add a link material (https only)' })
  addLink(
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() dto: CreateLinkMaterialDto,
  ): Promise<MaterialDto> {
    return this.modules.addLink(moduleId, dto);
  }

  @Delete('materials/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a material and its stored file' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.modules.removeMaterial(id);
  }
}
