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

  @ApiProperty({ example: 'kuqwc-tesoltefl-35620', maxLength: 40 })
  @TrimmedString(40)
  certificateId!: string;
}
