import { ApiProperty } from '@nestjs/swagger';
import { TrimmedString } from '../../../common/decorators/trimmed-string.decorator';

// Only the name is editable here — email is an identity/login key and is changed through
// a separate verified flow, never a plain profile update.
export class UpdateProfileDto {
  @ApiProperty({ example: 'Jane Doe', maxLength: 120 })
  @TrimmedString(120)
  name!: string;
}
