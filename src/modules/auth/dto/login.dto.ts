import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  // Named `email` for compatibility; also accepts a username.
  @ApiProperty({ example: 'jane@example.com', description: 'Email address, or the username the account chose.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  email!: string;

  // Deliberately no IsStrongPassword: that policy applies when setting a password, not logging in with a legacy one.
  @ApiProperty({ example: 'StrongPass123' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
