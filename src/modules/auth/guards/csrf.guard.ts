import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { AuthErrorCode, CSRF_COOKIE, CSRF_HEADER } from '../auth.constants';

// Double-submit CSRF check for routes that authenticate via the refresh cookie alone. A cross-site attacker can trigger the cookie to be
// sent but can't read it, so requiring the value echoed in a header (only same-origin JS can do that) proves the request is ours.
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const cookieToken = (request.cookies as Record<string, string> | undefined)?.[CSRF_COOKIE];
    const headerValue = request.headers[CSRF_HEADER];
    const headerToken = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
      throw new ForbiddenException({
        message: 'CSRF token missing or invalid',
        error: 'Forbidden',
        code: AuthErrorCode.CSRF_FAILED,
      });
    }

    return true;
  }
}

/** Constant-time compare so the check cannot be probed byte by byte. */
function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}
