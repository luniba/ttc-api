import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { numericTransformer } from '../../../common/transformers/numeric.transformer';
import { Candidate } from '../../candidates/entities/candidate.entity';
import { OrderItem } from './order-item.entity';

export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

// Entered by an admin on behalf of a candidate; there is no checkout yet.
@Entity('orders')
@Index('idx_orders_ordered_at', ['orderedAt'])
@Check('chk_orders_total', '(total >= (0)::numeric)')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // "TTC-1001", from the orders_order_no_seq sequence (see the migration). Plain unique index,
  // so a soft-deleted order's number is never reused.
  @Index('uq_orders_order_no', { unique: true })
  @Column({ name: 'order_no', type: 'varchar', length: 20 })
  orderNo!: string;

  @Index('idx_orders_candidate_id')
  @Column({ name: 'candidate_id', type: 'uuid' })
  candidateId!: string;

  // RESTRICT: candidates are only soft-deleted, so their orders always keep a holder.
  @ManyToOne(() => Candidate, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'candidate_id' })
  candidate!: Candidate;

  // When the order was placed, as the admin entered it (not when the row was created).
  @Column({ name: 'ordered_at', type: 'timestamptz' })
  orderedAt!: Date;

  @Column({ type: 'enum', enum: OrderStatus, enumName: 'order_status_enum' })
  status!: OrderStatus;

  // Sum of the items' prices, kept in step by the service.
  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: numericTransformer })
  total!: number;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items!: OrderItem[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
