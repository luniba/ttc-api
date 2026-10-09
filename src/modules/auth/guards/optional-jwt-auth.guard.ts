import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Populates request.user when a bearer token is present, no-ops otherwise — for endpoints (e.g. a public course page that shows enrollment state) that work for guests and signed-in
// users alike. Use as `@Public() @UseGuards(OptionalJwtAuthGuard)`: Public disables the global guard, this attaches the user if there is one.
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // No token, expired, or malformed — all fine, the caller is a guest.
    }
    return true;
  }

  // The base implementation throws when there is no user; here that's just the normal guest case.
  handleRequest<TUser>(_err: unknown, user: TUser): TUser {
    return user;
  }
}
