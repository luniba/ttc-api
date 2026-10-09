import { TrimmedString } from '../../../common/decorators/trimmed-string.decorator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsStrongPassword } from '../../../common/decorators/is-strong-password.decorator';

export class RegisterDto {
  @ApiProperty({ example: 'Jane Doe', maxLength: 120 })
  @TrimmedString(120)
  name!: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'StrongPass123', minLength: 8, maxLength: 72 })
  @IsStrongPassword()
  password!: string;

  @ApiPropertyOptional({
    description: 'Google reCAPTCHA v3 token. Required when RECAPTCHA_SECRET is configured.',
  })
  @IsOptional()
  @IsString()
  recaptchaToken?: string;
}
