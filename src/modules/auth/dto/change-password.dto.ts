import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { IsStrongPassword } from '../../../common/decorators/is-strong-password.decorator';

export class ChangePasswordDto {
  @ApiPropertyOptional({
    description:
      'Current password. Not required for Google-only accounts that are setting a password for the first time.',
  })
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsStrongPassword()
  newPassword!: string;
}
