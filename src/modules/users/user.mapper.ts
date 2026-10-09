import type { AuthProvider, User, UserRole } from './entities/user.entity';

// The only user shape that may cross the network boundary — an explicit allow-list, so a new sensitive entity column isn't picked up here.
export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  provider: AuthProvider;
  avatarUrl: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    provider: user.provider,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
