import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Enrolment } from './entities/enrolment.entity';

@Injectable()
export class EnrolmentsService {
  constructor(@InjectRepository(Enrolment) private readonly repo: Repository<Enrolment>) {}

  isEnrolled(userId: string, courseId: string): Promise<boolean> {
    return this.repo.existsBy({ userId, courseId });
  }

  // Idempotent.
  async grant(userId: string, courseId: string, grantedBy: string): Promise<{ created: boolean }> {
    if (await this.isEnrolled(userId, courseId)) return { created: false };
    try {
      await this.repo.insert({ userId, courseId, grantedBy });
      return { created: true };
    } catch (error) {
      // Concurrent grant: ignore.
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23505') return { created: false };
      throw error;
    }
  }

  async revoke(userId: string, courseId: string): Promise<void> {
    await this.repo.delete({ userId, courseId });
  }

  /** Newest first, with the course. */
  findForUser(userId: string): Promise<Enrolment[]> {
    return this.repo.find({ where: { userId }, relations: { course: true }, order: { grantedAt: 'DESC' } });
  }
}
