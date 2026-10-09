import { ApiProperty } from '@nestjs/swagger';
import { TrimmedString } from '../../../common/decorators/trimmed-string.decorator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'TESOL & TEFL', maxLength: 80 })
  @TrimmedString(80)
  name!: string;
}
