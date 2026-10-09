import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { IsStrongPassword } from '../../../common/decorators/is-strong-password.decorator';
import { TrimmedString } from '../../../common/decorators/trimmed-string.decorator';

// Deliberately no `role` field: accepting one from the body is exactly how an admin account gets minted by a caller who shouldn't.
export class CreateStaffDto {
  @ApiProperty({ example: 'Jane Smith', maxLength: 120 })
  @TrimmedString(120)
  name!: string;

  @ApiProperty({ example: 'jane@lms.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'Instructor123',
    description:
      'The admin sets this and passes it on. Same policy as every other password: 8-72 bytes, at least one letter and one number.',
  })
  @IsStrongPassword()
  password!: string;
}

// No `password` here — setting one is its own endpoint so it can evict the target's sessions, which a profile edit must not do.
export class UpdateStaffDto {
  @ApiPropertyOptional({ example: 'Jane Smith', maxLength: 120 })
  @IsOptional()
  @TrimmedString(120)
  name?: string;

  @ApiPropertyOptional({ example: 'jane@lms.local' })
  @IsOptional()
  @IsEmail()
  email?: string;
}

// No currentPassword, unlike /auth/change-password: the admin's role is the authority, which is why this is restricted to instructor targets.
export class SetStaffPasswordDto {
  @ApiProperty({ example: 'Instructor456' })
  @IsStrongPassword()
  password!: string;
}

export class StaffQueryDto {
  @ApiPropertyOptional({ description: 'Free-text search over name and email.' })
  @IsOptional()
  @IsString()
  q?: string;
}
