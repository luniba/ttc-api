import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile, type VerifyCallback } from 'passport-google-oauth20';
import type { GoogleConfig } from '../../../config/configuration';
import type { GoogleProfileData } from '../../users/users.service';

// `validate` only normalizes the profile; the controller turns it into an account and issues our own tokens. Placeholder credentials
// keep the app booting when Google isn't configured — the flow then just fails at Google instead of crashing the API.
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    const google = config.getOrThrow<GoogleConfig>('google');
    super({
      clientID: google.clientId || 'google-oauth-not-configured',
      clientSecret: google.clientSecret || 'google-oauth-not-configured',
      callbackURL: google.callbackUrl,
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;

    if (!email) {
      done(new Error('Google account did not return an email address'));
      return;
    }

    const data: GoogleProfileData = {
      googleId: profile.id,
      email,
      name: profile.displayName ?? email,
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };

    done(null, data);
  }
}
