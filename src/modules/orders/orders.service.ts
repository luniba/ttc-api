import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, type EntityManager, type SelectQueryBuilder } from 'typeorm';
import { Paginated } from '../../common/types/api-response';
import { escapeLike } from '../../common/utils/escape-like';
import { Candidate } from '../candidates/entities/candidate.entity';
import { Course } from '../courses/entities/course.entity';
import type { CreateOrderDto, OrderQueryDto, UpdateOrderDto } from './dto/order.dto';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { toOrderDto, type OrderDto } from './orders.mapper';

// Summed in cents so 0.1 + 0.2 never shows up on an invoice.
export const sumPrices = (prices: number[]): number =>
  prices.reduce((cents, p) => cents + Math.round(p * 100), 0) / 100;

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly repo: Repository<Order>,
    @InjectRepository(Candidate) private readonly candidates: Repository<Candidate>,
  ) {}

  // withDeleted for the joins: a candidate deleted later still shows on their orders.
  private query(): SelectQueryBuilder<Order> {
    return this.repo
      .createQueryBuilder('order')
      .innerJoinAndSelect('order.candidate', 'candidate')
      .leftJoinAndSelect('order.items', 'item')
      .withDeleted()
      .andWhere('order.deletedAt IS NULL');
  }

  async findAll(query: OrderQueryDto): Promise<Paginated<OrderDto>> {
    const qb = this.query();

    if (query.status) qb.andWhere('order.status = :status', { status: query.status });

    const term = query.q?.trim();
    if (term) {
      qb.andWhere(
        `(order.orderNo ILIKE :term OR candidate.passportName ILIKE :term
          OR candidate.email ILIKE :term OR candidate.certificateId ILIKE :term)`,
        { term: `%${escapeLike(term)}%` },
      );
    }

    // id tie-break so equal timestamps can't swap between pages.
    qb.orderBy('order.orderedAt', 'DESC').addOrderBy('order.id', 'ASC').addOrderBy('item.courseTitle', 'ASC');

    const [orders, total] = await qb.take(query.limit).skip(query.skip).getManyAndCount();
    return new Paginated(orders.map(toOrderDto), total, query.page, query.limit);
  }

  async findOne(id: string): Promise<OrderDto> {
    const order = await this.query()
      .andWhere('order.id = :id', { id })
      .addOrderBy('item.courseTitle', 'ASC')
      .getOne();
    if (!order) throw new NotFoundException('Order not found');
    return toOrderDto(order);
  }

  async create(dto: CreateOrderDto): Promise<OrderDto> {
    await this.assertCandidateExists(dto.candidateId);

    const id = await this.repo.manager.transaction(async (em) => {
      const items = await this.newItems(em, dto.courseIds);
      const [{ n }] = await em.query<{ n: string }[]>(`SELECT nextval('orders_order_no_seq') AS n`);
      const order = em.create(Order, {
        orderNo: `TTC-${n}`,
        candidateId: dto.candidateId,
        orderedAt: new Date(dto.orderedAt),
        status: dto.status,
        total: sumPrices(items.map((i) => i.price)),
        items,
      });
      return (await em.save(order)).id;
    });
    return this.findOne(id);
  }

  async update(id: string, dto: UpdateOrderDto): Promise<OrderDto> {
    await this.repo.manager.transaction(async (em) => {
      const order = await em.findOne(Order, { where: { id }, relations: { items: true } });
      if (!order) throw new NotFoundException('Order not found');

      if (dto.candidateId !== undefined && dto.candidateId !== order.candidateId) {
        await this.assertCandidateExists(dto.candidateId);
        order.candidateId = dto.candidateId;
      }
      if (dto.orderedAt !== undefined) order.orderedAt = new Date(dto.orderedAt);
      if (dto.status !== undefined) order.status = dto.status;

      if (dto.courseIds !== undefined) {
        // Courses already on the order keep the price they were added at; new ones take today's.
        const wanted = new Set(dto.courseIds);
        const kept = order.items.filter((i) => wanted.has(i.courseId));
        const added = await this.newItems(
          em,
          dto.courseIds.filter((courseId) => !kept.some((i) => i.courseId === courseId)),
        );
        const removed = order.items.filter((i) => !wanted.has(i.courseId));
        if (removed.length) await em.delete(OrderItem, removed.map((i) => i.id));
        order.items = [...kept, ...added];
        order.total = sumPrices(order.items.map((i) => i.price));
      }

      await em.save(order);
    });
    return this.findOne(id);
  }

  // Soft delete: the order and its number can be restored.
  async remove(id: string): Promise<{ message: string }> {
    if (!(await this.repo.existsBy({ id }))) throw new NotFoundException('Order not found');
    await this.repo.softDelete(id);
    return { message: 'Order deleted' };
  }

  // Items for courses that exist now, with their current title and price copied in.
  private async newItems(em: EntityManager, courseIds: string[]): Promise<OrderItem[]> {
    if (courseIds.length === 0) return [];
    const courses = await em.findBy(Course, { id: In(courseIds) });
    const missing = courseIds.filter((cid) => !courses.some((c) => c.id === cid));
    if (missing.length) throw new BadRequestException(`No course with id "${missing[0]}"`);
    return courses.map((c) => em.create(OrderItem, { courseId: c.id, courseTitle: c.title, price: c.price }));
  }

  private async assertCandidateExists(candidateId: string): Promise<void> {
    if (!(await this.candidates.existsBy({ id: candidateId }))) {
      throw new BadRequestException(`No candidate with id "${candidateId}"`);
    }
  }
}
