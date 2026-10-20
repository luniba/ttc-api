import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';

export class UpdateUsernameDto {
  // No "@", so a username never looks like an email.
  @ApiProperty({ example: 'jane_doe', minLength: 3, maxLength: 30 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$/, {
    message: 'Use 3 to 30 characters: letters, numbers, dots, dashes or underscores, starting with a letter or number',
  })
  username!: string;
}
