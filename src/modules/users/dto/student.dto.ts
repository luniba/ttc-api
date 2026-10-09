import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class StudentQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Free-text search over name and email.' })
  @IsOptional()
  @IsString()
  q?: string;
}
