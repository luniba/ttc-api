import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import type { AppConfig, ContactConfig } from '../../config/configuration';
import { MailService } from '../../mail/mail.service';
import { generateCertificateId } from '../candidates/certificate-id';
import { Candidate } from '../candidates/entities/candidate.entity';
import { Course } from '../courses/entities/course.entity';
import { CheckoutDto } from './dto/checkout.dto';

const today = () => new Date().toISOString().slice(0, 10);

const isCertificateIdClash = (error: unknown): boolean =>
  error instanceof QueryFailedError &&
  (error.driverError as { code?: string; constraint?: string }).code === '23505' &&
  (error.driverError as { constraint?: string }).constraint === 'uq_candidates_certificate_id';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);
  private readonly to: string;
  private readonly phone: string;
  private readonly frontendUrl: string;

  constructor(
    config: ConfigService,
    private readonly mail: MailService,
    @InjectRepository(Candidate) private readonly candidates: Repository<Candidate>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
  ) {
    const contact = config.getOrThrow<ContactConfig>('contact');
    this.to = contact.to;
    this.phone = contact.phone;
    this.frontendUrl = config.getOrThrow<AppConfig>('app').frontendUrl;
  }

  // Saves the request as a candidate (unverified, no certificate yet) so the admin finds it in the Candidates list with nothing to
  // type in, then emails the admin. The record is the source of truth: a failed email is logged, never turned into an error, because
  // the request itself is safely stored.
  async request(dto: CheckoutDto): Promise<void> {
    const course = await this.courses.findOne({ where: { slug: dto.courseSlug, isPublished: true } });
    if (!course) throw new BadRequestException('That course is not available.');
    if (dto.dateOfBirth >= today()) throw new BadRequestException('dateOfBirth must be in the past');

    const details = {
      passportName: dto.passportName,
      passportNo: dto.passportNo,
      dateOfBirth: dto.dateOfBirth,
      address: dto.address,
      nationality: dto.nationality,
    };

    // The same person asking twice for the same course (a refresh, a second try) updates their open request instead of adding a duplicate.
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
      this.logger.error(`${what} failed: ${error instanceof Error ? error.message : String(error)}`);
    this.notifyAdmin(dto, course.title, candidateId, !!open).catch(failed('Purchase request notification'));
    // Only the first time: re-submitting the same request doesn't send them another receipt (or let a stranger's address be mailed repeatedly).
    if (!open) {
      this.mail
        .sendCheckoutConfirmation(dto.email, dto.passportName, course.title, this.phone, this.to)
        .catch(failed('Purchase confirmation email'));
    }
  }

  private async insert(dto: CheckoutDto, courseId: string, details: Partial<Candidate>): Promise<string> {
    // A generated ID clashing is about one in a trillion; retry a few times rather than fail.
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

  private async notifyAdmin(dto: CheckoutDto, courseTitle: string, candidateId: string, repeat: boolean): Promise<void> {
    if (!this.to) {
      this.logger.error('No admin email configured (CONTACT_TO_EMAIL or ADMIN_EMAIL); purchase request was saved but not emailed.');
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
    if (!sent) this.logger.error(`Purchase request ${candidateId} was saved but the admin email could not be sent.`);
  }
}
