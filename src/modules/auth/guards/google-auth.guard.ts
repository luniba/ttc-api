import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Triggers the redirect to Google's consent screen and handles the callback. */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {}
