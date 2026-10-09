import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { TrimmedString } from '../../../common/decorators/trimmed-string.decorator';

export class CreateCourseDto {
  @ApiProperty({ example: 'Advanced 120-Hour TEFL Course', maxLength: 160 })
  @TrimmedString(160)
  title!: string;

  @ApiPropertyOptional({
    example: 'advanced-120-hour-tefl-course',
    maxLength: 160,
    description: 'Derived from the title when omitted. An explicit slug that is taken is a 409 SLUG_TAKEN.',
  })
  @IsOptional()
  @TrimmedString(160)
  slug?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: 'Lifetime access', maxLength: 80 })
  @TrimmedString(80)
  duration!: string;

  @ApiProperty({ example: 'All levels', maxLength: 80 })
  @TrimmedString(80)
  level!: string;

  @ApiProperty({ example: '5,000+', maxLength: 40 })
  @TrimmedString(40)
  studentCount!: string;

  @ApiProperty({ description: 'Plain text; blank lines separate paragraphs.' })
  @TrimmedString(20_000)
  description!: string;

  @ApiProperty({ example: 99, minimum: 0, description: 'USD, up to two decimals.' })
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99_999_999.99)
  price!: number;

  // Tri-state: omitted = leave as-is, null = clear, string = set.
  @ApiPropertyOptional({ description: 'Storage key from POST /uploads — not a URL.', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(512)
  thumbnailKey?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

// skipNullProperties:false — null on a required column fails validation instead of reaching the database as a 500. thumbnailKey keeps its own null.
export class UpdateCourseDto extends PartialType(CreateCourseDto, { skipNullProperties: false }) {}

export enum CourseStatus {
  ALL = 'all',
  PUBLISHED = 'published',
  DRAFT = 'draft',
}

export class CourseAdminQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Searches the title.' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: CourseStatus, default: CourseStatus.ALL })
  @IsOptional()
  @IsEnum(CourseStatus)
  status: CourseStatus = CourseStatus.ALL;
}
