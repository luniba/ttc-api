import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, MaxLength } from 'class-validator';
import { TrimmedString } from '../../../common/decorators/trimmed-string.decorator';
import { CalendarDay } from '../../candidates/dto/candidate.dto';

// The candidate form minus certificate number and issue date.
export class CheckoutDto {
  @ApiProperty({ example: 'advanced-120-hour-tefl-course', description: 'The course to purchase.' })
  @TrimmedString(160)
  courseSlug!: string;

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

  @ApiProperty({ example: 'Nepal', maxLength: 80 })
  @TrimmedString(80)
  nationality!: string;
}
