import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { Paginated } from '../../common/types/api-response';
import { User, UserRole } from '../users/entities/user.entity';
import type { OrderDto } from './orders.mapper';
import { OrdersService } from './orders.service';
import { OrderQueryDto, CreateOrderDto, UpdateOrderDto } from './dto/order.dto';

@ApiTags('admin: orders')
@ApiBearerAuth('access-token')
@ApiForbiddenResponse({ description: 'Caller is not an admin.' })
@Roles(UserRole.ADMIN)
@Controller('admin/orders')
export class OrdersAdminController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @ApiOperation({
    summary: 'List orders',
    description: 'Newest order date first. `q` searches the order number and candidate; `status` filters. Counts arrive in `meta.pagination`.',
  })
  findAll(@Query() query: OrderQueryDto): Promise<Paginated<OrderDto>> {
    return this.orders.findAll(query);
  }

  @Post()
  @ApiOperation({
    summary: 'Create an order',
    description:
      "orderNo (TTC-1001…) is generated; item titles and prices are copied from the courses. Unknown candidate or course → 400. A completed order grants its courses to the candidate's login.",
  })
  create(@Body() dto: CreateOrderDto, @CurrentUser() admin: User): Promise<OrderDto> {
    return this.orders.create(dto, admin.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an order' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<OrderDto> {
    return this.orders.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an order',
    description:
      "orderNo never changes. Courses already on the order keep their price; new ones take the current price. A completed order grants its courses to the candidate's login.",
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderDto,
    @CurrentUser() admin: User,
  ): Promise<OrderDto> {
    return this.orders.update(id, dto, admin.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete an order' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.orders.remove(id);
  }
}
