import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({
    description: 'Google reCAPTCHA v3 token. Required when RECAPTCHA_SECRET is configured.',
  })
  @IsOptional()
  @IsString()
  recaptchaToken?: string;
}
