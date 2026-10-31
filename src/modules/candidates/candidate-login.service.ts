import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { generatePassword } from '../../common/utils/generate-password';
import type { AppConfig, ContactConfig } from '../../config/configuration';
import { MailService } from '../../mail/mail.service';
import { Course } from '../courses/entities/course.entity';
import { EnrolmentsService } from '../enrolments/enrolments.service';
import { OrderItem } from '../orders/entities/order-item.entity';
import { UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { Candidate } from './entities/candidate.entity';

// The admin's view of a student login. password is null once the student sets their own.
export interface CandidateLoginDto {
  hasAccount: boolean;
  username: string | null;
  password: string | null;
  passwordChangedByStudent: boolean;
}

// One course on the candidate's Courses tab: granted means their login can open it.
export interface CandidateCourseDto {
  id: string;
  title: string;
  granted: boolean;
  grantedAt: Date | null;
}

export interface CandidateCoursesDto {
  hasAccount: boolean;
  courses: CandidateCourseDto[];
}

@Injectable()
export class CandidateLoginService {
  private readonly logger = new Logger(CandidateLoginService.name);

  private readonly frontendUrl: string;
  private readonly teamEmail: string;

  constructor(
    config: ConfigService,
    @InjectRepository(Candidate) private readonly candidates: Repository<Candidate>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectRepository(OrderItem) private readonly orderItems: Repository<OrderItem>,
    private readonly users: UsersService,
    private readonly enrolments: EnrolmentsService,
    private readonly mail: MailService,
  ) {
    this.frontendUrl = config.getOrThrow<AppConfig>('app').frontendUrl;
    this.teamEmail = config.getOrThrow<ContactConfig>('contact').to;
  }

  async get(candidateId: string): Promise<CandidateLoginDto> {
    const candidate = await this.candidates.findOne({ where: { id: candidateId } });
    if (!candidate) throw new NotFoundException('Candidate not found');

    const user = candidate.userId ? await this.users.findById(candidate.userId) : null;
    if (!user) return { hasAccount: false, username: null, password: null, passwordChangedByStudent: false };

    const password = await this.users.revealTempPassword(user.id);
    return {
      hasAccount: true,
      // The username if set, otherwise the email.
      username: user.username ?? user.email,
      password,
      passwordChangedByStudent: password === null,
    };
  }

  // The course they asked for, the courses on their orders, and anything their login can already open.
  async listCourses(candidateId: string): Promise<CandidateCoursesDto> {
    const candidate = await this.candidates.findOne({ where: { id: candidateId }, relations: { course: true } });
    if (!candidate) throw new NotFoundException('Candidate not found');

    const [enrolled, ordered] = await Promise.all([
      candidate.userId ? this.enrolments.findForUser(candidate.userId) : [],
      this.orderItems
        .createQueryBuilder('item')
        .innerJoin('item.order', 'order')
        .where('order.candidateId = :candidateId', { candidateId })
        .andWhere('order.deletedAt IS NULL')
        .orderBy('item.courseTitle', 'ASC')
        .getMany(),
    ]);

    const grants = new Map(enrolled.map((e) => [e.courseId, e.grantedAt]));
    const list = new Map<string, CandidateCourseDto>();
    const add = (id: string, title: string) => {
      if (!list.has(id)) list.set(id, { id, title, granted: grants.has(id), grantedAt: grants.get(id) ?? null });
    };
    add(candidate.course.id, candidate.course.title);
    for (const e of enrolled) add(e.courseId, e.course.title);
    for (const i of ordered) add(i.courseId, i.courseTitle);
    return { hasAccount: !!candidate.userId, courses: [...list.values()] };
  }

  // Unlocks the course and emails the student; repeats do nothing.
  async grantCourse(candidateId: string, courseId: string, actorId: string): Promise<CandidateCoursesDto> {
    const candidate = await this.candidates.findOne({ where: { id: candidateId } });
    if (!candidate) throw new NotFoundException('Candidate not found');
    const course = await this.courses.findOne({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    if (!(await this.grantCourses(candidate, [course], actorId))) {
      throw new BadRequestException('This candidate has no login yet.');
    }
    return this.listCourses(candidateId);
  }

  // Grants the courses to the candidate's login, one email per new grant. False when there's no login yet.
  async grantCourses(
    candidate: Candidate,
    courses: { id: string; title: string }[],
    actorId: string,
  ): Promise<boolean> {
    const user = candidate.userId ? await this.users.findById(candidate.userId) : null;
    if (!user) return false;

    for (const course of courses) {
      const { created } = await this.enrolments.grant(user.id, course.id, actorId);
      if (!created) continue;
      this.logger.log(`Admin ${actorId} granted candidate ${candidate.id} access to course ${course.id}`);
      this.mail
        .sendAccessGranted(user.email, user.name, course.title, `${this.frontendUrl}/account`, this.teamEmail)
        .catch((error: unknown) =>
          this.logger.error(`Access email failed: ${error instanceof Error ? error.message : String(error)}`),
        );
    }
    return true;
  }

  async revokeCourse(candidateId: string, courseId: string, actorId: string): Promise<CandidateCoursesDto> {
    const candidate = await this.candidates.findOne({ where: { id: candidateId } });
    if (!candidate) throw new NotFoundException('Candidate not found');
    if (candidate.userId) {
      await this.enrolments.revoke(candidate.userId, courseId);
      this.logger.log(`Admin ${actorId} revoked candidate ${candidateId}'s access to course ${courseId}`);
    }
    return this.listCourses(candidateId);
  }

  // Creates a student login from the record's email, or links the existing account. Never changes a password; never links staff.
  async createLogin(candidateId: string, actorId: string, sendEmail = false): Promise<CandidateLoginDto> {
    const candidate = await this.candidates.findOne({ where: { id: candidateId } });
    if (!candidate) throw new NotFoundException('Candidate not found');
    if (candidate.userId) return this.get(candidateId);

    const email = candidate.email.trim().toLowerCase();
    if (!email) throw new BadRequestException('This candidate has no email address. Add one first.');

    const existing = await this.users.findByEmail(email);
    if (existing) {
      await this.linkExisting(candidate, existing.id, existing.role, actorId);
      return this.get(candidateId);
    }

    let created: { user: { id: string; email: string }; password: string };
    try {
      created = await this.users.createStudentWithTempPassword(email, candidate.passportName);
    } catch (error) {
      // Created just now by someone else; link to it.
      const raced = await this.users.findByEmail(email);
      if (!raced) throw error;
      await this.linkExisting(candidate, raced.id, raced.role, actorId);
      return this.get(candidateId);
    }

    await this.candidates.update(candidateId, { userId: created.user.id });
    this.logger.log(`Admin ${actorId} created a login for candidate ${candidateId}`);

    if (sendEmail) {
      this.mail
        .sendLoginDetails(
          created.user.email,
          candidate.passportName,
          created.user.email,
          created.password,
          `${this.frontendUrl}/login`,
          `${this.frontendUrl}/forgot-password`,
          this.teamEmail,
        )
        .then((sent) => sent || this.logger.error(`Login details email for candidate ${candidateId} could not be sent.`))
        .catch((error: unknown) =>
          this.logger.error(`Login details email failed: ${error instanceof Error ? error.message : String(error)}`),
        );
    }
    return this.get(candidateId);
  }

  private async linkExisting(candidate: Candidate, userId: string, role: UserRole, actorId: string): Promise<void> {
    if (role !== UserRole.STUDENT) {
      throw new BadRequestException("That email belongs to a staff account, so a student login can't be created for it.");
    }
    await this.candidates.update(candidate.id, { userId });
    this.logger.log(`Admin ${actorId} linked candidate ${candidate.id} to the existing account for ${candidate.email}`);
  }

  async setPassword(candidateId: string, actorId: string, password?: string): Promise<CandidateLoginDto> {
    const candidate = await this.candidates.findOne({ where: { id: candidateId } });
    if (!candidate) throw new NotFoundException('Candidate not found');
    if (!candidate.userId) throw new BadRequestException('This candidate has no login yet.');

    await this.users.setStudentPassword(candidate.userId, password ?? generatePassword());
    // Log who and for whom, never the password.
    this.logger.log(`Admin ${actorId} changed the login password for candidate ${candidateId}`);
    return this.get(candidateId);
  }
}
