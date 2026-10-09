import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import type { AppConfig, AuthConfig } from '../../config/configuration';
import { MailService } from '../../mail/mail.service';
import { User } from '../users/entities/user.entity';
import { toSafeUser, type SafeUser } from '../users/user.mapper';
import { UsersService, type GoogleProfileData } from '../users/users.service';
import { AuthErrorCode } from './auth.constants';
import { RefreshToken } from './entities/refresh-token.entity';
import type { JwtPayload } from './types/jwt-payload.interface';

export interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult extends TokenPair {
  user: SafeUser;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

// A real bcrypt hash compared against when no account matches (see validateUser), so a missing user takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync(randomBytes(32).toString('hex'), 12);

@Injectable()
export class AuthService {
  private readonly cfg: AuthConfig;
  private readonly app: AppConfig;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    config: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshRepo: Repository<RefreshToken>,
  ) {
    this.cfg = config.getOrThrow<AuthConfig>('auth');
    this.app = config.getOrThrow<AppConfig>('app');
  }

  // No tokens issued here: with REQUIRE_EMAIL_VERIFIED on, the account can't log in yet.
  async register(input: { email: string; password: string; name: string }): Promise<{
    message: string;
  }> {
    const email = UsersService.normalizeEmail(input.email);
    const existing = await this.users.findByEmail(email);

    if (existing) {
      // Registration inherently reveals whether an email is taken; rate limiting is what keeps this from being a bulk enumeration oracle.
      throw new ConflictException('An account with that email already exists');
    }

    const user = await this.users.create({
      email,
      name: input.name,
      password: input.password,
      emailVerified: false,
    });

    await this.sendVerificationEmail(user);

    return {
      message: 'Account created. Check your email for a confirmation link.',
    };
  }

  private async sendVerificationEmail(user: User): Promise<void> {
    const rawToken = randomBytes(32).toString('hex');

    user.emailVerifyTokenHash = this.hashToken(rawToken);
    user.emailVerifyExpiresAt = new Date(Date.now() + this.cfg.verifyTtlHours * HOUR_MS);
    await this.users.save(user);

    const link = `${this.app.frontendUrl}/verify-email?token=${rawToken}`;
    await this.mail.sendVerifyEmail(user.email, user.name, link, this.cfg.verifyTtlHours);
  }

  /** Confirms an address and signs the user straight in. */
  async verifyEmail(rawToken: string, context: SessionContext): Promise<LoginResult> {
    const user = await this.users.findByTokenHash('emailVerifyTokenHash', this.hashToken(rawToken));

    if (!user || !user.emailVerifyExpiresAt || user.emailVerifyExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired verification link');
    }

    user.emailVerified = true;
    user.emailVerifyTokenHash = null;
    user.emailVerifyExpiresAt = null;
    await this.users.save(user);

    await this.mail.sendWelcome(user.email, user.name);

    return this.issueSession(user, context);
  }

  /** Always resolves the same way, so it cannot be used to test for accounts. */
  async resendVerification(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);

    if (!user || user.emailVerified) {
      return;
    }

    await this.sendVerificationEmail(user);
  }

  // Still runs a bcrypt compare against a throwaway hash when no account exists, so timing can't reveal whether the email is registered.
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.users.findByEmailWithSecrets(email);

    if (!user?.passwordHash) {
      await bcrypt.compare(password, DUMMY_HASH);
      return null;
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    return matches ? user : null;
  }

  async login(user: User, context: SessionContext): Promise<LoginResult> {
    if (this.cfg.requireEmailVerified && !user.emailVerified) {
      throw new ForbiddenException({
        message: 'Confirm your email address before signing in.',
        error: 'Forbidden',
        code: AuthErrorCode.EMAIL_NOT_VERIFIED,
      });
    }

    return this.issueSession(user, context);
  }

  async loginWithGoogle(profile: GoogleProfileData, context: SessionContext): Promise<LoginResult> {
    const user = await this.users.findOrCreateGoogleUser(profile);
    // No email-verified gate: Google already proved ownership of the address.
    return this.issueSession(user, context);
  }

  // Rotation makes a token single-use — the row is deleted on redemption, so a replayed stolen token just misses.
  async refresh(rawRefreshToken: string, context: SessionContext): Promise<LoginResult> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const existing = await this.refreshRepo.findOne({ where: { tokenHash } });

    if (!existing) {
      throw new UnauthorizedException({
        message: 'Invalid or expired session',
        error: 'Unauthorized',
        code: AuthErrorCode.INVALID_SESSION,
      });
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      await this.refreshRepo.delete(existing.id);
      throw new UnauthorizedException({
        message: 'Invalid or expired session',
        error: 'Unauthorized',
        code: AuthErrorCode.INVALID_SESSION,
      });
    }

    const user = await this.users.findById(existing.userId);

    if (!user) {
      await this.refreshRepo.delete(existing.id);
      throw new UnauthorizedException({
        message: 'Invalid or expired session',
        error: 'Unauthorized',
        code: AuthErrorCode.INVALID_SESSION,
      });
    }

    await this.refreshRepo.delete(existing.id);

    return this.issueSession(user, context);
  }

  // Silent when the token is unknown — logout is idempotent.
  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }
    await this.refreshRepo.delete({ tokenHash: this.hashToken(rawRefreshToken) });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.refreshRepo.delete({ userId });
  }

  // Resolves identically whether or not the account exists, so the endpoint can't be used to discover registered emails.
  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);

    if (!user) {
      return;
    }

    // Google-only accounts have no password to reset; sending a link would let anyone with that mailbox attach a password to it.
    if (!(await this.hasPassword(user.email))) {
      return;
    }

    const rawToken = randomBytes(32).toString('hex');

    user.passwordResetTokenHash = this.hashToken(rawToken);
    user.passwordResetExpiresAt = new Date(Date.now() + this.cfg.resetTtlMinutes * MINUTE_MS);
    await this.users.save(user);

    const link = `${this.app.frontendUrl}/reset-password?token=${rawToken}`;
    await this.mail.sendPasswordReset(user.email, link, this.cfg.resetTtlMinutes);
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const user = await this.users.findByTokenHash(
      'passwordResetTokenHash',
      this.hashToken(rawToken),
    );

    if (
      !user ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    user.passwordHash = await this.users.hashPassword(newPassword);
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    // Completing a reset proves mailbox control, the same evidence accepted for verification.
    user.emailVerified = true;
    await this.users.save(user);

    // A reset is the recovery path for a compromised account, so every existing session must die.
    await this.logoutAll(user.id);
    await this.mail.sendPasswordChanged(user.email);
  }

  // Changes the password of a signed-in user, or sets the first one for a Google-only account.
  async changePassword(
    userId: string,
    currentPassword: string | undefined,
    newPassword: string,
  ): Promise<void> {
    const user = await this.users.findById(userId);

    if (!user) {
      throw new BadRequestException('Account not found');
    }

    const withSecrets = await this.users.findByEmailWithSecrets(user.email);

    if (withSecrets?.passwordHash) {
      if (!currentPassword) {
        throw new BadRequestException('Current password is required');
      }
      const matches = await bcrypt.compare(currentPassword, withSecrets.passwordHash);
      if (!matches) {
        // 400, not 401: a 401 would make the client try to refresh its session.
        throw new BadRequestException({
          message: 'Current password is incorrect',
          error: 'Bad Request',
          code: AuthErrorCode.INVALID_CREDENTIALS,
        });
      }
    }

    user.passwordHash = await this.users.hashPassword(newPassword);
    await this.users.save(user);

    // Same reasoning as resetPassword: the usual reason to change a password is suspecting someone else has a session.
    await this.logoutAll(user.id);
    await this.mail.sendPasswordChanged(user.email);
  }

  async hasPassword(email: string): Promise<boolean> {
    const user = await this.users.findByEmailWithSecrets(email);
    return !!user?.passwordHash;
  }

  /** Update the signed-in user's display name. Email stays immutable here by design. */
  async updateProfile(userId: string, name: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new BadRequestException('Account not found');
    }
    user.name = name;
    return this.users.save(user);
  }

  private async issueSession(user: User, context: SessionContext): Promise<LoginResult> {
    const accessToken = await this.issueAccessToken(user);
    const refreshToken = await this.createRefreshToken(user.id, context);
    return { user: toSafeUser(user), accessToken, refreshToken };
  }

  private issueAccessToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwt.signAsync(payload);
  }

  private async createRefreshToken(userId: string, context: SessionContext): Promise<string> {
    const raw = randomBytes(48).toString('hex');

    await this.refreshRepo.save(
      this.refreshRepo.create({
        userId,
        tokenHash: this.hashToken(raw),
        expiresAt: new Date(Date.now() + this.cfg.refreshTtlDays * DAY_MS),
        userAgent: context.userAgent?.slice(0, 255) ?? null,
        ipAddress: context.ipAddress?.slice(0, 64) ?? null,
      }),
    );

    return raw;
  }

  // SHA-256, not bcrypt: these tokens are CSPRNG output with nothing to brute-force, and refresh runs on the hot path.
  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
