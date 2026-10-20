import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { IsStrongPassword } from '../../../common/decorators/is-strong-password.decorator';

export class SetLoginPasswordDto {
  @ApiPropertyOptional({ description: 'The new password. Leave it out to have one generated.', minLength: 8 })
  @IsOptional()
  @IsStrongPassword()
  password?: string;
}
