import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUrl, MaxLength } from 'class-validator';
import { TrimmedString } from '../../../common/decorators/trimmed-string.decorator';

export class CreateLinkMaterialDto {
  @ApiProperty({ example: 'Intro video', maxLength: 200 })
  @TrimmedString(200)
  title!: string;

  @ApiProperty({ example: 'https://www.youtube.com/watch?v=…', maxLength: 2048 })
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  url!: string;
}

// Multipart text fields alongside `file`.
export class UploadFileMaterialDto {
  @ApiPropertyOptional({ maxLength: 200, description: 'Defaults to the file name without its extension.' })
  @IsOptional()
  @TrimmedString(200)
  title?: string;
}
