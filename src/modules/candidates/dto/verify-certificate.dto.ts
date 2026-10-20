import { ApiProperty } from '@nestjs/swagger';
import { TrimmedString } from '../../../common/decorators/trimmed-string.decorator';

// What a member of the public types from a printed certificate.
export class VerifyCertificateDto {
  @ApiProperty({ example: 'Jane Mary Doe', maxLength: 160 })
  @TrimmedString(160)
  fullName!: string;

  @ApiProperty({ example: 'PA1234567', maxLength: 40 })
  @TrimmedString(40)
  passportNumber!: string;

  // Free-form: no fixed format.
  @ApiProperty({ example: 'TTC-257-5084', maxLength: 60 })
  @TrimmedString(60)
  certificateNo!: string;
}
