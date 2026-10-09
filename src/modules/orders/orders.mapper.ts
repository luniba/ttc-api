import type { Order } from './entities/order.entity';
import type { OrderStatus } from './entities/order.entity';

// Explicit allow-list rather than the entity, so a new column doesn't leak the day it's added.
export interface OrderDto {
  id: string;
  orderNo: string;
  candidate: { id: string; passportName: string; email: string; certificateId: string };
  items: { courseId: string; title: string; price: number }[];
  total: number;
  status: OrderStatus;
  orderedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const toOrderDto = (o: Order): OrderDto => ({
  id: o.id,
  orderNo: o.orderNo,
  candidate: {
    id: o.candidate.id,
    passportName: o.candidate.passportName,
    email: o.candidate.email,
    certificateId: o.candidate.certificateId,
  },
  items: o.items.map((i) => ({ courseId: i.courseId, title: i.courseTitle, price: i.price })),
  total: o.total,
  status: o.status,
  orderedAt: o.orderedAt,
  createdAt: o.createdAt,
  updatedAt: o.updatedAt,
});
