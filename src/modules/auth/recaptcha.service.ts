import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RecaptchaConfig } from '../../config/configuration';

interface RecaptchaVerifyResponse {
  success: boolean;
  score?: number;
  action?: string;
  'error-codes'?: string[];
}

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

// v3 is score-based (0..1 confidence, rejected below RECAPTCHA_MIN_SCORE). Fails closed when Google is unreachable — failing open would
// turn an outage into a free bypass on exactly the endpoints that need protection most. No secret configured just skips verification.
@Injectable()
export class RecaptchaService {
  private readonly logger = new Logger(RecaptchaService.name);
  private readonly cfg: RecaptchaConfig;

  constructor(config: ConfigService) {
    this.cfg = config.getOrThrow<RecaptchaConfig>('recaptcha');
    if (!this.cfg.enabled) {
      this.logger.warn('RECAPTCHA_SECRET is not set — captcha verification is disabled.');
    }
  }

  get enabled(): boolean {
    return this.cfg.enabled;
  }

  /** True if the token is valid, or if reCAPTCHA is switched off. */
  async verify(token: string | undefined, remoteIp?: string): Promise<boolean> {
    if (!this.cfg.enabled) {
      return true;
    }
    if (!token) {
      return false;
    }

    try {
      const params = new URLSearchParams({ secret: this.cfg.secret, response: token });
      if (remoteIp) {
        params.set('remoteip', remoteIp);
      }

      const response = await fetch(VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal: AbortSignal.timeout(5000),
      });

      const data = (await response.json()) as RecaptchaVerifyResponse;

      if (!data.success) {
        this.logger.warn(`reCAPTCHA rejected: ${(data['error-codes'] ?? []).join(', ')}`);
        return false;
      }

      if (typeof data.score === 'number') {
        return data.score >= this.cfg.minScore;
      }

      return true;
    } catch (error) {
      this.logger.warn(
        `reCAPTCHA verification failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
