import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { MailConfig } from '../config/configuration';
import {
  checkoutConfirmationTemplate,
  contactConfirmationTemplate,
  contactMessageTemplate,
  passwordChangedTemplate,
  passwordResetTemplate,
  purchaseRequestTemplate,
  verifyEmailTemplate,
  welcomeTemplate,
  type ContactMessage,
  type EmailContent,
  type PurchaseRequest,
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

  // Unlike the account emails, the sender is waiting on this one, so the result is returned: false means it was not delivered.
  // Reply-To is the visitor, so staff answer straight from their inbox.
  sendContactMessage(to: string, message: ContactMessage): Promise<boolean> {
    return this.deliver(to, contactMessageTemplate(message), message.email);
  }

  // Staff notification for a website purchase request; Reply-To is the candidate. False means it wasn't delivered.
  sendPurchaseRequest(to: string, request: PurchaseRequest): Promise<boolean> {
    return this.deliver(to, purchaseRequestTemplate(request), request.email);
  }

  // Receipts for the person who filled in a form. Best effort: the request itself is already safe, so a failure is only logged.
  // Replies go to the team (`replyTo`) because the From address is a no-reply.
  async sendCheckoutConfirmation(to: string, name: string, course: string, phone: string, replyTo: string): Promise<void> {
    await this.deliver(to, checkoutConfirmationTemplate(name, course, phone), replyTo || undefined);
  }

  async sendContactConfirmation(to: string, name: string, phone: string, replyTo: string): Promise<void> {
    await this.deliver(to, contactConfirmationTemplate(name, phone), replyTo || undefined);
  }

  private async send(to: string, content: EmailContent): Promise<void> {
    await this.deliver(to, content);
  }

  private async deliver(to: string, content: EmailContent, replyTo?: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(`[DEV] Email to ${to} — ${content.subject}\n${content.text}`);
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        replyTo,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });
      this.logger.log(`Sent "${content.subject}" to ${to}`);
      return true;
    } catch (error) {
      // Not rethrown: for account emails the caller's operation already succeeded, and a bounced SMTP connection shouldn't surface as a 500.
      this.logger.error(
        `Failed to send "${content.subject}" to ${to}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }
}
