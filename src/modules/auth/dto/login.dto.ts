import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email!: string;

  // Deliberately no IsStrongPassword: that policy applies when setting a password, not logging in with a legacy one.
  @ApiProperty({ example: 'StrongPass123' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
