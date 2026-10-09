import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { MailConfig } from '../config/configuration';
import {
  passwordChangedTemplate,
  passwordResetTemplate,
  verifyEmailTemplate,
  welcomeTemplate,
  type EmailContent,
} from './mail.templates';

// Locally points at mailpit, which captures everything and delivers nothing. If SMTP_HOST is unset, degrades to logging instead of
// throwing — failing to send a welcome email shouldn't fail the registration that triggered it.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter?: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    const mail = config.getOrThrow<MailConfig>('mail');
    this.from = mail.from;

    if (!mail.host) {
      this.logger.warn('SMTP_HOST is not set — emails will be logged to the console, not sent.');
      return;
    }

    this.transporter = createTransport({
      host: mail.host,
      port: mail.port,
      secure: mail.secure,
      auth: mail.user ? { user: mail.user, pass: mail.pass } : undefined,
    });
  }

  sendVerifyEmail(to: string, name: string, link: string, ttlHours: number): Promise<void> {
    return this.send(to, verifyEmailTemplate(name, link, ttlHours));
  }

  sendPasswordReset(to: string, link: string, ttlMinutes: number): Promise<void> {
    return this.send(to, passwordResetTemplate(link, ttlMinutes));
  }

  sendPasswordChanged(to: string): Promise<void> {
    return this.send(to, passwordChangedTemplate());
  }

  sendWelcome(to: string, name: string): Promise<void> {
    return this.send(to, welcomeTemplate(name));
  }

  private async send(to: string, content: EmailContent): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(`[DEV] Email to ${to} — ${content.subject}\n${content.text}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });
      this.logger.log(`Sent "${content.subject}" to ${to}`);
    } catch (error) {
      // Swallowed on purpose: the caller's operation already succeeded, and a bounced SMTP connection shouldn't surface as a 500.
      this.logger.error(
        `Failed to send "${content.subject}" to ${to}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
