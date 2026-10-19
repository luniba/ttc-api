import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ContactConfig } from '../../config/configuration';
import { MailService } from '../../mail/mail.service';
import { Course } from '../courses/entities/course.entity';
import { ContactDto } from './dto/contact.dto';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);
  private readonly to: string;
  private readonly phone: string;

  constructor(
    config: ConfigService,
    private readonly mail: MailService,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
  ) {
    const contact = config.getOrThrow<ContactConfig>('contact');
    this.to = contact.to;
    this.phone = contact.phone;
  }

  // Fails loudly (503) rather than pretending: a visitor who sees "sent" for a message nobody received is worse than an error.
  async send(dto: ContactDto): Promise<void> {
    if (!this.to) {
      this.logger.error('Contact form is not configured: set CONTACT_TO_EMAIL or ADMIN_EMAIL.');
      throw new ServiceUnavailableException('Messages can’t be sent right now. Please email us directly.');
    }

    // The slug is only a label for the email; an unknown or deleted course is shown as typed rather than rejected.
    const course = dto.courseSlug
      ? await this.courses.findOne({ where: { slug: dto.courseSlug }, select: { title: true } })
      : null;

    const sent = await this.mail.sendContactMessage(this.to, {
      name: `${dto.firstName} ${dto.lastName}`,
      email: dto.email,
      phone: dto.phone ?? null,
      course: course?.title ?? dto.courseSlug ?? null,
      message: dto.message,
      subscribe: dto.subscribe,
    });
    if (!sent) throw new ServiceUnavailableException('We couldn’t send your message. Please try again in a moment.');

    // A receipt for the sender, after the team's copy is safely out; its failure never fails the request.
    this.mail
      .sendContactConfirmation(dto.email, dto.firstName, this.phone, this.to)
      .catch((error: unknown) =>
        this.logger.error(`Contact confirmation email failed: ${error instanceof Error ? error.message : String(error)}`),
      );
  }
}
