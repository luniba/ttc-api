import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsStrongPassword } from '../../../common/decorators/is-strong-password.decorator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsStrongPassword()
  newPassword!: string;
}
