import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsStrongPassword } from '../../../common/decorators/is-strong-password.decorator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'The token from the reset link.' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'NewStrongPass123', minLength: 8, maxLength: 72 })
  @IsStrongPassword()
  password!: string;
}
