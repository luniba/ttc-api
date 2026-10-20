import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import type { AppConfig, ContactConfig } from '../../config/configuration';
import { MailService } from '../../mail/mail.service';
import type { CheckoutAccess } from '../../mail/mail.templates';
import { generateCertificateId } from '../candidates/certificate-id';
import { Candidate } from '../candidates/entities/candidate.entity';
import { Course } from '../courses/entities/course.entity';
import { UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { CheckoutDto } from './dto/checkout.dto';

const today = () => new Date().toISOString().slice(0, 10);

const isCertificateIdClash = (error: unknown): boolean =>
  error instanceof QueryFailedError &&
  (error.driverError as { code?: string; constraint?: string }).code ===
    '23505' &&
  (error.driverError as { constraint?: string }).constraint ===
    'uq_candidates_certificate_id';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);
  private readonly to: string;
  private readonly phone: string;
  private readonly frontendUrl: string;

  constructor(
    config: ConfigService,
    private readonly mail: MailService,
    @InjectRepository(Candidate)
    private readonly candidates: Repository<Candidate>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    private readonly users: UsersService,
  ) {
    const contact = config.getOrThrow<ContactConfig>('contact');
    this.to = contact.to;
    this.phone = contact.phone;
    this.frontendUrl = config.getOrThrow<AppConfig>('app').frontendUrl;
  }

  // Saves the request as an unverified candidate, then emails the admin. A failed email is only logged.
  async request(dto: CheckoutDto): Promise<void> {
    const course = await this.courses.findOne({
      where: { slug: dto.courseSlug, isPublished: true },
    });
    if (!course) throw new BadRequestException('That course is not available.');
    if (dto.dateOfBirth >= today())
      throw new BadRequestException('dateOfBirth must be in the past');

    const details = {
      passportName: dto.passportName,
      passportNo: dto.passportNo,
      dateOfBirth: dto.dateOfBirth,
      address: dto.address,
      nationality: dto.nationality,
    };

    // The same email asking again for a course updates its open request.
    const open = await this.candidates.findOne({
      where: { email: dto.email, courseId: course.id, certificateNo: IsNull() },
    });

    let candidateId: string;
    if (open) {
      await this.candidates.update(open.id, details);
      candidateId = open.id;
    } else {
      candidateId = await this.insert(dto, course.id, details);
    }

    const failed = (what: string) => (error: unknown) =>
      this.logger.error(
        `${what} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    this.notifyAdmin(dto, course.title, candidateId, !!open).catch(
      failed('Purchase request notification'),
    );
    const access = open?.userId
      ? null
      : await this.ensureLogin(candidateId, dto);

    // One receipt per request; repeats don't re-send.
    if (access && (!open || access.kind === 'created')) {
      this.mail
        .sendCheckoutConfirmation(
          dto.email,
          dto.passportName,
          course.title,
          this.phone,
          this.to,
          access,
        )
        .catch(failed('Purchase confirmation email'));
    }
  }

  // Creates a student login or links the existing account. Never changes an existing password.
  private async ensureLogin(
    candidateId: string,
    dto: CheckoutDto,
  ): Promise<CheckoutAccess> {
    const loginUrl = `${this.frontendUrl}/login`;
    const resetUrl = `${this.frontendUrl}/forgot-password`;
    const existing = await this.users.findByEmail(dto.email);
    if (existing)
      return this.linkExisting(
        candidateId,
        existing.id,
        existing.role,
        loginUrl,
        resetUrl,
      );

    try {
      const { user, password } = await this.users.createStudentWithTempPassword(
        dto.email,
        dto.passportName,
      );
      await this.candidates.update(candidateId, { userId: user.id });
      return {
        kind: 'created',
        username: user.email,
        password,
        loginUrl,
        resetUrl,
      };
    } catch (error) {
      // Lost a race: the account was just created.
      const created = await this.users.findByEmail(dto.email);
      if (!created) throw error;
      return this.linkExisting(
        candidateId,
        created.id,
        created.role,
        loginUrl,
        resetUrl,
      );
    }
  }

  private async linkExisting(
    candidateId: string,
    userId: string,
    role: UserRole,
    loginUrl: string,
    resetUrl: string,
  ): Promise<CheckoutAccess> {
    // Never link staff accounts.
    if (role === UserRole.STUDENT)
      await this.candidates.update(candidateId, { userId });
    return { kind: 'existing', loginUrl, resetUrl };
  }

  private async insert(
    dto: CheckoutDto,
    courseId: string,
    details: Partial<Candidate>,
  ): Promise<string> {
    // Retry on the rare generated-ID clash.
    for (let attempt = 0; ; attempt++) {
      try {
        const saved = await this.candidates.save(
          this.candidates.create({
            ...details,
            email: dto.email,
            courseId,
            certificateId: generateCertificateId(),
            certificateNo: null,
            issueDate: null,
            isVerified: false,
          }),
        );
        return saved.id;
      } catch (error) {
        if (isCertificateIdClash(error) && attempt < 4) continue;
        throw error;
      }
    }
  }

  private async notifyAdmin(
    dto: CheckoutDto,
    courseTitle: string,
    candidateId: string,
    repeat: boolean,
  ): Promise<void> {
    if (!this.to) {
      this.logger.error(
        'No admin email configured (CONTACT_TO_EMAIL or ADMIN_EMAIL); purchase request was saved but not emailed.',
      );
      return;
    }
    const sent = await this.mail.sendPurchaseRequest(this.to, {
      course: courseTitle,
      name: dto.passportName,
      email: dto.email,
      passportNo: dto.passportNo,
      dateOfBirth: dto.dateOfBirth,
      nationality: dto.nationality,
      address: dto.address,
      adminLink: `${this.frontendUrl}/admin/candidates/${candidateId}`,
      repeat,
    });
    if (!sent)
      this.logger.error(
        `Purchase request ${candidateId} was saved but the admin email could not be sent.`,
      );
  }
}
