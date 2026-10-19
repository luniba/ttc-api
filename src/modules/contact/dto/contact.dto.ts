import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, MaxLength } from 'class-validator';
import { TrimmedString } from '../../../common/decorators/trimmed-string.decorator';

// The public contact form. Mirrors the client's payload exactly (forbidNonWhitelisted rejects anything extra).
export class ContactDto {
  @ApiProperty({ example: 'Jane', maxLength: 80 })
  @TrimmedString(80)
  firstName!: string;

  @ApiProperty({ example: 'Doe', maxLength: 80 })
  @TrimmedString(80)
  lastName!: string;

  @ApiProperty({ example: 'jane@example.com', maxLength: 254 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiPropertyOptional({ example: '+1 555 0100', maxLength: 40 })
  @IsOptional()
  @TrimmedString(40)
  phone?: string;

  @ApiPropertyOptional({ example: 'advanced-120-hour-tefl-course', description: 'The course the message is about.' })
  @IsOptional()
  @TrimmedString(160)
  courseSlug?: string;

  @ApiProperty({ maxLength: 5000 })
  @TrimmedString(5000)
  message!: string;

  @ApiProperty({ description: 'Whether they ticked the newsletter box.' })
  @IsBoolean()
  subscribe!: boolean;
}
