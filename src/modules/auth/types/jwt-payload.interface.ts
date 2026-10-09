import type { UserRole } from '../../users/entities/user.entity';

/** Claims carried by the access token. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}
