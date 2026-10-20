import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StorageService } from '../../storage/storage.service';
import { Candidate } from '../candidates/entities/candidate.entity';
import { EnrolmentsService } from '../enrolments/enrolments.service';
import type { User } from '../users/entities/user.entity';
import { toSafeUser, type SafeUser } from '../users/user.mapper';
import { UsersService } from '../users/users.service';

// enrolled: access granted. requested: still waiting.
export interface AccountCourseDto {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  status: 'enrolled' | 'requested';
  /** Granted or requested date, per status. */
  since: Date;
}

export interface AccountCertificateDto {
  courseTitle: string;
  certificateNo: string | null;
  issueDate: string | null;
  // verified by an admin, or still being prepared.
  status: 'verified' | 'preparing';
}

export interface AccountDto {
  profile: SafeUser;
  courses: AccountCourseDto[];
  certificates: AccountCertificateDto[];
}

@Injectable()
export class AccountService {
  constructor(
    private readonly users: UsersService,
    private readonly enrolments: EnrolmentsService,
    private readonly storage: StorageService,
    @InjectRepository(Candidate) private readonly candidates: Repository<Candidate>,
  ) {}

  // By user id only; nothing in the URL to tamper with.
  async get(user: User): Promise<AccountDto> {
    const [enrolled, candidates] = await Promise.all([
      this.enrolments.findForUser(user.id),
      this.candidates.find({ where: { userId: user.id }, relations: { course: true }, order: { createdAt: 'DESC' } }),
    ]);

    const courses = new Map<string, AccountCourseDto>();
    const add = (c: NonNullable<Candidate['course']>, status: AccountCourseDto['status'], since: Date) => {
      if (!c.isPublished || courses.has(c.id)) return;
      courses.set(c.id, {
        id: c.id,
        slug: c.slug,
        title: c.title,
        thumbnailUrl: c.thumbnailKey ? this.storage.getUrl(c.thumbnailKey) : null,
        status,
        since,
      });
    };
    for (const e of enrolled) add(e.course, 'enrolled', e.grantedAt);
    for (const c of candidates) add(c.course, 'requested', c.createdAt);

    return {
      profile: toSafeUser(user),
      courses: [...courses.values()],
      certificates: candidates.map((c) => ({
        courseTitle: c.course.title,
        certificateNo: c.certificateNo,
        issueDate: c.issueDate,
        status: c.isVerified ? 'verified' : 'preparing',
      })),
    };
  }

  async setUsername(userId: string, username: string): Promise<SafeUser> {
    return toSafeUser(await this.users.setUsername(userId, username));
  }
}
