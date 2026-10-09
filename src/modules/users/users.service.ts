import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { ErrorCode } from '../../common/constants/error-codes';
import { Paginated } from '../../common/types/api-response';
import { escapeLike } from '../../common/utils/escape-like';
import type { AuthConfig } from '../../config/configuration';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import type { StudentQueryDto } from './dto/student.dto';
import {
  AuthProvider,
  STAFF_ROLES,
  User,
  UserRole,
  isStaff,
} from './entities/user.entity';

export interface GoogleProfileData {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface CreateUserInput {
  email: string;
  name: string;
  password?: string;
  role?: UserRole;
  emailVerified?: boolean;
}

// The admin view of a student. A deliberately trimmed shape — none of the auth/token columns.
export interface StudentDto {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  provider: AuthProvider;
  createdAt: Date;
}

/** Columns that are select:false but needed for auth decisions. */
const AUTH_COLUMNS = [
  'user.passwordHash',
  'user.emailVerifyTokenHash',
  'user.emailVerifyExpiresAt',
  'user.passwordResetTokenHash',
  'user.passwordResetExpiresAt',
] as const;

@Injectable()
export class UsersService {
  private readonly cfg: AuthConfig;

  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    // Only used to evict sessions on an instructor password reset — see setStaffPassword for why this isn't AuthService.logoutAll.
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    config: ConfigService,
  ) {
    this.cfg = config.getOrThrow<AuthConfig>('auth');
  }

  /** Case and whitespace differences must not create duplicate accounts. */
  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.cfg.bcryptRounds);
  }

  findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({
      where: { email: UsersService.normalizeEmail(email) },
    });
  }

  /** Loads a user together with the select:false auth columns. */
  findByEmailWithSecrets(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .addSelect([...AUTH_COLUMNS])
      .where('user.email = :email', {
        email: UsersService.normalizeEmail(email),
      })
      .getOne();
  }

  findByTokenHash(
    column: 'passwordResetTokenHash' | 'emailVerifyTokenHash',
    hash: string,
  ): Promise<User | null> {
    return this.repo
      .createQueryBuilder('user')
      .addSelect([...AUTH_COLUMNS])
      .where(`user.${column} = :hash`, { hash })
      .getOne();
  }

  async create(input: CreateUserInput): Promise<User> {
    const user = this.repo.create({
      email: UsersService.normalizeEmail(input.email),
      name: input.name.trim(),
      role: input.role ?? UserRole.STUDENT,
      provider: AuthProvider.LOCAL,
      passwordHash: input.password
        ? await this.hashPassword(input.password)
        : null,
      emailVerified: input.emailVerified ?? false,
    });
    return this.repo.save(user);
  }

  // Lookup order matters: googleId first (stable link), then email — which lets a password-registered user later sign in with Google
  // onto the same account. Only safe because Google has already verified the address.
  async findOrCreateGoogleUser(profile: GoogleProfileData): Promise<User> {
    const byGoogleId = await this.repo.findOne({
      where: { googleId: profile.googleId },
    });
    if (byGoogleId) {
      return byGoogleId;
    }

    const email = UsersService.normalizeEmail(profile.email);
    const existing = await this.findByEmail(email);

    if (existing) {
      existing.googleId = profile.googleId;
      existing.emailVerified = true;
      existing.avatarUrl ??= profile.avatarUrl;
      return this.repo.save(existing);
    }

    const user = this.repo.create({
      email,
      name: profile.name.trim() || email,
      role: UserRole.STUDENT,
      provider: AuthProvider.GOOGLE,
      googleId: profile.googleId,
      avatarUrl: profile.avatarUrl,
      // Google has already proven ownership of the address.
      emailVerified: true,
      passwordHash: null,
    });
    return this.repo.save(user);
  }

  save(user: User): Promise<User> {
    return this.repo.save(user);
  }

  /** Admins and instructors — i.e. everyone who can reach the admin panel. */
  findStaff(search?: string): Promise<User[]> {
    const qb = this.repo
      .createQueryBuilder('user')
      .where('user.role IN (:...roles)', { roles: [...STAFF_ROLES] });

    const term = search?.trim();
    if (term) {
      qb.andWhere('(user.name ILIKE :term OR user.email ILIKE :term)', {
        term: `%${escapeLike(term)}%`,
      });
    }

    // Admins first, then newest instructor — role's enum sort follows declaration order (admin < instructor < student).
    return qb
      .orderBy('user.role', 'ASC')
      .addOrderBy('user.createdAt', 'DESC')
      .getMany();
  }

  // The admin student list: students only (staff live in findStaff), newest first.
  async listStudents(query: StudentQueryDto): Promise<Paginated<StudentDto>> {
    const qb = this.repo
      .createQueryBuilder('user')
      .where('user.role = :role', { role: UserRole.STUDENT });

    const term = query.q?.trim();
    if (term) {
      qb.andWhere('(user.name ILIKE :term OR user.email ILIKE :term)', {
        term: `%${escapeLike(term)}%`,
      });
    }

    const [users, total] = await qb
      .orderBy('user.createdAt', 'DESC')
      .take(query.limit)
      .skip(query.skip)
      .getManyAndCount();

    const items = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      provider: user.provider,
      createdAt: user.createdAt,
    }));

    return new Paginated(items, total, query.page, query.limit);
  }

  // `role` is hard-coded, never from input — a caller-supplied role would make this an admin-minting endpoint. `emailVerified: true`
  // because handing over a password IS the verification here; there's no invite email, and login refuses unverified accounts otherwise.
  async createInstructor(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<User> {
    const email = UsersService.normalizeEmail(input.email);

    const existing = await this.repo.findOne({
      where: { email },
      withDeleted: true,
    });
    if (existing) {
      throw new ConflictException({
        message: `An account with the email "${email}" already exists`,
        error: 'Conflict',
        code: ErrorCode.EMAIL_TAKEN,
      });
    }

    return this.create({
      email,
      name: input.name,
      password: input.password,
      role: UserRole.INSTRUCTOR,
      emailVerified: true,
    });
  }

  // Editing and password-setting apply to instructors only — never another admin, never yourself. Changing an admin's password or email
  // is impersonation; your own goes through /auth/change-password, where you prove you know the current one.
  private async findEditableInstructor(
    id: string,
    actorId: string,
  ): Promise<User> {
    if (id === actorId) {
      throw new ForbiddenException(
        'Use your own account settings to change your details',
      );
    }

    const user = await this.repo.findOne({ where: { id } });
    if (!user || !isStaff(user.role)) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== UserRole.INSTRUCTOR) {
      throw new ForbiddenException(
        'Only instructors can be edited here',
      );
    }

    return user;
  }

  /** Updates an instructor's name/email. Admin-gated at the controller. */
  async updateStaff(
    id: string,
    actorId: string,
    input: { name?: string; email?: string },
  ): Promise<User> {
    const user = await this.findEditableInstructor(id, actorId);

    if (input.email !== undefined) {
      const email = UsersService.normalizeEmail(input.email);
      if (email !== user.email) {
        const taken = await this.repo.findOne({
          where: { email },
          withDeleted: true,
        });
        if (taken) {
          throw new ConflictException({
            message: `An account with the email "${email}" already exists`,
            error: 'Conflict',
            code: ErrorCode.EMAIL_TAKEN,
          });
        }
        user.email = email;
      }
    }

    if (input.name !== undefined) user.name = input.name.trim();

    return this.repo.save(user);
  }

  // No current-password check, unlike /auth/change-password: the admin's role is the authority here, which is why the target is
  // restricted to instructors. Every session the instructor holds is dropped, so the old password stops working.
  async setStaffPassword(
    id: string,
    actorId: string,
    password: string,
  ): Promise<{ message: string }> {
    const user = await this.findEditableInstructor(id, actorId);

    user.passwordHash = await this.hashPassword(password);
    await this.repo.save(user);

    // Deletes tokens directly rather than calling AuthService.logoutAll, since AuthModule imports UsersModule and the reverse
    // dependency would be circular without forwardRef.
    await this.refreshTokens.delete({ userId: user.id });

    return { message: 'Password updated' };
  }

  // Refuses self-deletion: removing your own account is almost always a misclick, and if you're the last admin it locks the panel.
  async removeStaff(id: string, actorId: string): Promise<{ message: string }> {
    if (id === actorId) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    const user = await this.repo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!isStaff(user.role)) {
      throw new NotFoundException('User not found');
    }

    await this.repo.softDelete(id);
    return { message: 'User deleted' };
  }
}
