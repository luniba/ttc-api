import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { OrderStatus } from '../entities/order.entity';

// orderNo is not here: the server generates it. Prices come from the courses, not the client.
export class CreateOrderDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  candidateId!: string;

  @ApiProperty({ type: [String], format: 'uuid', description: 'One or more courses, no repeats.' })
  @ArrayMinSize(1, { message: 'Choose at least one course' })
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  courseIds!: string[];

  @ApiProperty({ example: '2026-10-08T09:30:00.000Z', description: 'When the order was placed (ISO 8601 with zone).' })
  @IsISO8601({ strict: true })
  orderedAt!: string;

  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}

// skipNullProperties:false — null on a required column fails validation instead of reaching the database as a 500.
export class UpdateOrderDto extends PartialType(CreateOrderDto, { skipNullProperties: false }) {}

export class OrderQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Searches the order number and the candidate (name, email, certificate ID).' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
