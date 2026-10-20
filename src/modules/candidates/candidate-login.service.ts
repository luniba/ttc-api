import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { generatePassword } from '../../common/utils/generate-password';
import type { AppConfig, ContactConfig } from '../../config/configuration';
import { MailService } from '../../mail/mail.service';
import { EnrolmentsService } from '../enrolments/enrolments.service';
import { UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { Candidate } from './entities/candidate.entity';

// The admin's view of a student login. password is null once the student sets their own.
export interface CandidateLoginDto {
  hasAccount: boolean;
  username: string | null;
  password: string | null;
  passwordChangedByStudent: boolean;
  // An admin has granted access.
  enrolled: boolean;
}

@Injectable()
export class CandidateLoginService {
  private readonly logger = new Logger(CandidateLoginService.name);

  private readonly frontendUrl: string;
  private readonly teamEmail: string;

  constructor(
    config: ConfigService,
    @InjectRepository(Candidate) private readonly candidates: Repository<Candidate>,
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
    if (!user) return { hasAccount: false, username: null, password: null, passwordChangedByStudent: false, enrolled: false };

    const password = await this.users.revealTempPassword(user.id);
    return {
      hasAccount: true,
      // The username if set, otherwise the email.
      username: user.username ?? user.email,
      password,
      passwordChangedByStudent: password === null,
      enrolled: await this.enrolments.isEnrolled(user.id, candidate.courseId),
    };
  }

  // Grants access and emails the student; repeats do nothing.
  async grantAccess(candidateId: string, actorId: string): Promise<CandidateLoginDto> {
    const candidate = await this.candidates.findOne({ where: { id: candidateId }, relations: { course: true } });
    if (!candidate) throw new NotFoundException('Candidate not found');
    if (!candidate.userId) throw new BadRequestException('This candidate has no login yet.');
    const user = await this.users.findById(candidate.userId);
    if (!user) throw new BadRequestException('This candidate has no login yet.');

    const { created } = await this.enrolments.grant(user.id, candidate.courseId, actorId);
    if (created) {
      this.logger.log(`Admin ${actorId} granted candidate ${candidateId} access to course ${candidate.courseId}`);
      this.mail
        .sendAccessGranted(user.email, user.name, candidate.course.title, `${this.frontendUrl}/account`, this.teamEmail)
        .catch((error: unknown) =>
          this.logger.error(`Access email failed: ${error instanceof Error ? error.message : String(error)}`),
        );
    }
    return this.get(candidateId);
  }

  async revokeAccess(candidateId: string, actorId: string): Promise<CandidateLoginDto> {
    const candidate = await this.candidates.findOne({ where: { id: candidateId } });
    if (!candidate) throw new NotFoundException('Candidate not found');
    if (candidate.userId) {
      await this.enrolments.revoke(candidate.userId, candidate.courseId);
      this.logger.log(`Admin ${actorId} revoked candidate ${candidateId}'s access to course ${candidate.courseId}`);
    }
    return this.get(candidateId);
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
