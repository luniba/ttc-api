import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TrimmedString } from '../../../common/decorators/trimmed-string.decorator';
import { ModuleType } from '../entities/course-module.entity';

export class CreateModuleDto {
  @ApiProperty({ example: 'Module 1: Introduction', maxLength: 200 })
  @TrimmedString(200)
  title!: string;

  @ApiPropertyOptional({ enum: ModuleType, default: ModuleType.LESSON, description: 'Fixed once created.' })
  @IsOptional()
  @IsEnum(ModuleType)
  type?: ModuleType;

  @ApiPropertyOptional({ description: 'Rich-text HTML. Sanitised on the server; disallowed tags/attributes are stripped.' })
  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  content?: string;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000)
  durationMinutes?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPreview?: boolean;
}

// skipNullProperties:false — null fails validation instead of reaching a NOT NULL column as a 500.
// type is left out: it never changes after create.
export class UpdateModuleDto extends PartialType(OmitType(CreateModuleDto, ['type'] as const), {
  skipNullProperties: false,
}) {}

// Trims each option, so "  run " and "run" count as the same.
const trim = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value) ? (value as unknown[]).map((v) => (typeof v === 'string' ? v.trim() : v)) : value;

export class QuizQuestionDto {
  @ApiProperty({ example: 'Which word is a verb?', maxLength: 1000 })
  @TrimmedString(1000)
  prompt!: string;

  @ApiProperty({ type: [String], example: ['run', 'blue', 'table', 'quickly'], description: 'Exactly four, A to D.' })
  @Transform(trim)
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @ArrayUnique({ message: 'The four options must all be different' })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(300, { each: true })
  options!: string[];

  @ApiProperty({ minimum: 0, maximum: 3, description: 'Index of the correct option (0 = A).' })
  @IsInt()
  @Min(0)
  @Max(3)
  correctIndex!: number;
}

// A visitor's picks, one per question in order (0 = A).
export class CheckQuizDto {
  @ApiProperty({ type: [Number], example: [0, 2, 1] })
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(3, { each: true })
  answers!: number[];
}

// The quiz's whole question list in its new order; replaces what was there.
export class ReplaceQuestionsDto {
  @ApiProperty({ type: [QuizQuestionDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionDto)
  questions!: QuizQuestionDto[];
}

// The whole new order in one request, so a drag can't half-apply.
export class ReorderModulesDto {
  @ApiProperty({ type: [String], description: "Exactly this course's module ids, in the new order." })
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  moduleIds!: string[];
}
