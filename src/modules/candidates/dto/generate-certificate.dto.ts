import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { TrimmedString } from '../../../common/decorators/trimmed-string.decorator';
import { CalendarDay } from './candidate.dto';

// What the printed certificate and transcript show. Nothing here is saved.
export class GenerateCertificateDto {
  @ApiProperty({
    example: 'Hiyari Mohamed',
    maxLength: 160,
    description: 'Printed in capitals.',
  })
  @TrimmedString(160)
  passportName!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'A TEFL or TESOL course; its title gives the "120-Hour TESOL" wording.',
  })
  @IsUUID()
  courseId!: string;

  @ApiProperty({ example: 'TTC-1132-8345', maxLength: 60 })
  @TrimmedString(60)
  certificateNo!: string;

  @ApiProperty({
    example: '1998-10-25',
    format: 'date',
    description: 'Printed on the transcript only.',
  })
  @CalendarDay()
  dateOfBirth!: string;

  @ApiProperty({ example: '2026-11-23', format: 'date' })
  @CalendarDay()
  issueDate!: string;
}
