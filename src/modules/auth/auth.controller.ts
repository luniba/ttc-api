import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiExcludeEndpoint,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { GoogleConfig } from '../../config/configuration';
import { User } from '../users/entities/user.entity';
import { toSafeUser, type SafeUser } from '../users/user.mapper';
import type { GoogleProfileData } from '../users/users.service';
import { AuthErrorCode, REFRESH_COOKIE } from './auth.constants';
import { AuthService, type SessionContext } from './auth.service';
import { CookieService } from './cookie.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendVerificationDto, VerifyEmailDto } from './dto/verify-email.dto';
import { CsrfGuard } from './guards/csrf.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { RecaptchaService } from './recaptcha.service';

/** Shape returned whenever a session is established. */
interface SessionResponse {
  user: SafeUser;
  accessToken: string;
  /** Echo back in the X-CSRF-Token header on /auth/refresh and /auth/logout. */
  csrfToken: string;
}

@ApiTags('auth')
@Controller('auth')
// Default cap for the whole controller; individual routes tighten it further.
@Throttle({ default: { ttl: 60_000, limit: 20 } })
export class AuthController {
  private readonly google: GoogleConfig;

  constructor(
    private readonly auth: AuthService,
    private readonly recaptcha: RecaptchaService,
    private readonly cookies: CookieService,
    config: ConfigService,
  ) {
    this.google = config.getOrThrow<GoogleConfig>('google');
  }

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: 'Create a student account and send a verification email',
    description:
      'Returns no session: the account cannot sign in until the email is confirmed.',
  })
  @ApiConflictResponse({ description: 'Email already registered.' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    await this.assertHuman(dto.recaptchaToken, req);
    return this.auth.register(dto);
  }

  @Post('verify-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Confirm an email address and sign in' })
  @ApiOkResponse({ description: 'Email confirmed; a session is established.' })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    const result = await this.auth.verifyEmail(dto.token, sessionContext(req));
    return this.establishSession(res, result);
  }

  @Post('resend-verification')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({ summary: 'Resend the verification email' })
  @ApiOkResponse({ description: 'Always the same generic message.' })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.auth.resendVerification(dto.email);
    return {
      message: 'If that account exists and is unconfirmed, a new link has been sent.',
    };
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiOkResponse({ description: 'Access token in the body, refresh token in an httpOnly cookie.' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials.' })
  @ApiForbiddenResponse({ description: 'Email not yet confirmed.' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    await this.assertHuman(dto.recaptchaToken, req);

    const user = await this.auth.validateUser(dto.email, dto.password);

    if (!user) {
      // Same message for "no such account" and "wrong password" so we don't confirm whether an address is registered.
      throw new UnauthorizedException({
        message: 'Invalid email or password',
        error: 'Unauthorized',
        code: AuthErrorCode.INVALID_CREDENTIALS,
      });
    }

    const result = await this.auth.login(user, sessionContext(req));
    return this.establishSession(res, result);
  }

  @Get('google')
  @Public()
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Start Google OAuth. Redirects to Google.' })
  googleAuth(): void {
    // The guard performs the redirect; this body never runs.
  }

  @Get('google/callback')
  @Public()
  @UseGuards(GoogleAuthGuard)
  @ApiExcludeEndpoint()
  async googleCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const profile = req.user as GoogleProfileData;

    try {
      const result = await this.auth.loginWithGoogle(profile, sessionContext(req));
      this.cookies.setSession(res, result.refreshToken);

      // No tokens in the redirect URL — query strings land in browser history and server logs; the session rides in the cookie set above.
      res.redirect(this.google.successRedirect);
    } catch (error) {
      const url = new URL(this.google.successRedirect);
      url.searchParams.set('error', 'google_auth_failed');
      res.redirect(url.toString());
      void error;
    }
  }

  @Post('refresh')
  @Public()
  @UseGuards(CsrfGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate the refresh cookie and issue a new access token',
    description:
      'Reads the httpOnly refresh cookie. Requires the X-CSRF-Token header to match the CSRF cookie.',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired session.' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    const token = readRefreshCookie(req);

    if (!token) {
      throw new UnauthorizedException({
        message: 'Invalid or expired session',
        error: 'Unauthorized',
        code: AuthErrorCode.INVALID_SESSION,
      });
    }

    try {
      const result = await this.auth.refresh(token, sessionContext(req));
      return this.establishSession(res, result);
    } catch (error) {
      // The cookie is dead; drop it so the browser stops replaying it.
      this.cookies.clearSession(res);
      throw error;
    }
  }

  @Post('logout')
  @Public()
  @UseGuards(CsrfGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the current session' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(readRefreshCookie(req));
    this.cookies.clearSession(res);
    return { message: 'Logged out' };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke every session for the current user' })
  async logoutAll(@CurrentUser() user: User, @Res({ passthrough: true }) res: Response) {
    await this.auth.logoutAll(user.id);
    this.cookies.clearSession(res);
    return { message: 'All sessions revoked' };
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @ApiOperation({ summary: 'Request a password reset link' })
  @ApiOkResponse({ description: 'Always the same generic message.' })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    await this.assertHuman(dto.recaptchaToken, req);
    await this.auth.forgotPassword(dto.email);
    return {
      message: 'If an account exists for that email, a reset link has been sent.',
    };
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({
    summary: 'Set a new password using a reset token',
    description: 'Revokes every existing session for the account.',
  })
  async resetPassword(@Body() dto: ResetPasswordDto, @Res({ passthrough: true }) res: Response) {
    await this.auth.resetPassword(dto.token, dto.password);
    this.cookies.clearSession(res);
    return { message: 'Password updated. Sign in with your new password.' };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Change the password of the signed-in user',
    description: 'Revokes every existing session, including this one.',
  })
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword);
    this.cookies.clearSession(res);
    return { message: 'Password updated. Sign in again.' };
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get the signed-in user' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  async me(@CurrentUser() user: User) {
    return {
      ...toSafeUser(user),
      hasPassword: await this.auth.hasPassword(user.email),
    };
  }

  @Patch('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: "Update the signed-in user's profile (name)" })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  async updateMe(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    const updated = await this.auth.updateProfile(user.id, dto.name);
    return {
      ...toSafeUser(updated),
      hasPassword: await this.auth.hasPassword(updated.email),
    };
  }

  private establishSession(
    res: Response,
    result: { user: SafeUser; accessToken: string; refreshToken: string },
  ): SessionResponse {
    const csrfToken = this.cookies.setSession(res, result.refreshToken);
    // refreshToken stays out of the body — it lives only in the httpOnly cookie, unreachable by XSS.
    return { user: result.user, accessToken: result.accessToken, csrfToken };
  }

  private async assertHuman(token: string | undefined, req: Request): Promise<void> {
    const passed = await this.recaptcha.verify(token, req.ip);
    if (!passed) {
      throw new UnauthorizedException({
        message: 'Captcha verification failed',
        error: 'Unauthorized',
        code: AuthErrorCode.CAPTCHA_FAILED,
      });
    }
  }
}

const readRefreshCookie = (req: Request): string | undefined =>
  (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];

const sessionContext = (req: Request): SessionContext => ({
  userAgent: req.headers['user-agent'],
  ipAddress: req.ip,
});
