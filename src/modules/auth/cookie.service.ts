import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import type { CookieOptions, Response } from 'express';
import type { AuthConfig } from '../../config/configuration';
import { CSRF_COOKIE, REFRESH_COOKIE } from './auth.constants';

const DAY_MS = 24 * 60 * 60 * 1000;

// Owns every auth cookie written by the API so security flags are decided once here, not re-specified at each call site.
@Injectable()
export class CookieService {
  private readonly cfg: AuthConfig;

  constructor(config: ConfigService) {
    this.cfg = config.getOrThrow<AuthConfig>('auth');
  }

  setSession(res: Response, refreshToken: string): string {
    const csrfToken = randomBytes(32).toString('hex');

    res.cookie(REFRESH_COOKIE, refreshToken, this.refreshOptions());
    res.cookie(CSRF_COOKIE, csrfToken, this.csrfOptions());

    return csrfToken;
  }

  clearSession(res: Response): void {
    // Options must match those used to set the cookie, or the browser keeps it.
    res.clearCookie(REFRESH_COOKIE, { ...this.refreshOptions(), maxAge: undefined });
    res.clearCookie(CSRF_COOKIE, { ...this.csrfOptions(), maxAge: undefined });
  }

  private refreshOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.cfg.cookie.secure,
      sameSite: this.cfg.cookie.sameSite,
      domain: this.cfg.cookie.domain,
      path: this.cfg.cookie.refreshPath,
      maxAge: this.cfg.refreshTtlDays * DAY_MS,
    };
  }

  private csrfOptions(): CookieOptions {
    return {
      // Readable by JS on purpose: the frontend echoes it back in a header for the double-submit check.
      httpOnly: false,
      secure: this.cfg.cookie.secure,
      sameSite: this.cfg.cookie.sameSite,
      domain: this.cfg.cookie.domain,
      path: '/',
      maxAge: this.cfg.refreshTtlDays * DAY_MS,
    };
  }
}
