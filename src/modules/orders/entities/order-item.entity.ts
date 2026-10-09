import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { numericTransformer } from '../../../common/transformers/numeric.transformer';
import { Course } from '../../courses/entities/course.entity';
import { Order } from './order.entity';

// One course in an order. Title and price are copied when the course is added, so the order
// still reads the same after the course is renamed or repriced.
@Entity('order_items')
@Index('uq_order_items_order_course', ['orderId', 'courseId'], { unique: true })
@Check('chk_order_items_price', '(price >= (0)::numeric)')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE', orphanedRowAction: 'delete' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Index('idx_order_items_course_id')
  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string;

  @ManyToOne(() => Course, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'course_id' })
  course!: Course;

  @Column({ name: 'course_title', type: 'varchar', length: 160 })
  courseTitle!: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: numericTransformer })
  price!: number;
}
