import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class CreateLoginDto {
  @ApiPropertyOptional({ description: 'Email the username and password to the student. Off by default.', default: false })
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;
}
