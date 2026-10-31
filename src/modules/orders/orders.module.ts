import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CandidatesModule } from '../candidates/candidates.module';
import { Candidate } from '../candidates/entities/candidate.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { OrdersAdminController } from './orders.admin.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, Candidate]), CandidatesModule],
  controllers: [OrdersAdminController],
  providers: [OrdersService],
})
export class OrdersModule {}
