import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsISO8601, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { TrimmedString } from '../../../common/decorators/trimmed-string.decorator';

// A calendar day with no time or zone, as <input type="date"> sends it. strict rejects 2026-02-30.
const CalendarDay = () =>
  applyDecorators(
    Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '$property must be a date as YYYY-MM-DD' }),
    IsISO8601({ strict: true }, { message: '$property must be a real calendar date' }),
  );

// certificateId is not here: the server generates it.
export class CreateCandidateDto {
  @ApiProperty({ example: 'TTC-2026-00153', maxLength: 60 })
  @TrimmedString(60)
  certificateNo!: string;

  @ApiProperty({ example: 'Jane Mary Doe', maxLength: 160, description: 'As printed in the passport.' })
  @TrimmedString(160)
  passportName!: string;

  @ApiProperty({ example: 'PA1234567', maxLength: 40 })
  @TrimmedString(40)
  passportNo!: string;

  @ApiProperty({ example: '1995-04-21', format: 'date' })
  @CalendarDay()
  dateOfBirth!: string;

  @ApiProperty({ example: '12 Lake Road, Pokhara, Nepal', maxLength: 500 })
  @TrimmedString(500)
  address!: string;

  @ApiProperty({ example: 'jane@example.com', maxLength: 254 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ format: 'uuid', description: 'The assigned course.' })
  @IsUUID()
  courseId!: string;

  @ApiProperty({ example: '2026-10-08', format: 'date' })
  @CalendarDay()
  issueDate!: string;

  @ApiProperty({ example: 'Nepal', maxLength: 80 })
  @TrimmedString(80)
  nationality!: string;
}

// skipNullProperties:false — null on a required column fails validation instead of reaching the database as a 500.
export class UpdateCandidateDto extends PartialType(CreateCandidateDto, { skipNullProperties: false }) {}

export class CandidateQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Searches certificate ID and number, passport name and number, and email.',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'true: verified only; false: unverified only; omit for all.' })
  @IsOptional()
  // Reads the raw string: implicit conversion would already have turned "false" into true.
  @Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) =>
    obj[key] === 'true' ? true : obj[key] === 'false' ? false : obj[key],
  )
  @IsBoolean()
  verified?: boolean;
}
