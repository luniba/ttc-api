import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  // Full admin panel access except user management (see STAFF_ROLES and UsersAdminController) — the whole difference from ADMIN.
  INSTRUCTOR = 'instructor',
  STUDENT = 'student',
}

// Who may reach the admin panel at all — adding a role here grants the whole panel, so do that deliberately.
export const STAFF_ROLES = [
  UserRole.ADMIN,
  UserRole.INSTRUCTOR,
] as const;

export const isStaff = (role: UserRole): boolean =>
  (STAFF_ROLES as readonly UserRole[]).includes(role);

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Stored lowercase and trimmed (normalised in UsersService) so uniqueness is
  // real — otherwise Jane@x.com and jane@x.com would be two accounts.
  @Index('uq_users_email', { unique: true })
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  // select:false keeps it out of every default query — it can only leak if explicitly asked for.
  @Column({
    name: 'password_hash',
    type: 'varchar',
    nullable: true,
    select: false,
  })
  passwordHash!: string | null;

  @Column({ type: 'varchar', length: 120, default: '' })
  name!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.STUDENT })
  role!: UserRole;

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified!: boolean;

  @Column({
    name: 'email_verify_token_hash',
    type: 'varchar',
    nullable: true,
    select: false,
  })
  emailVerifyTokenHash!: string | null;

  @Column({
    name: 'email_verify_expires_at',
    type: 'timestamptz',
    nullable: true,
    select: false,
  })
  emailVerifyExpiresAt!: Date | null;

  @Column({
    name: 'password_reset_token_hash',
    type: 'varchar',
    nullable: true,
    select: false,
  })
  passwordResetTokenHash!: string | null;

  @Column({
    name: 'password_reset_expires_at',
    type: 'timestamptz',
    nullable: true,
    select: false,
  })
  passwordResetExpiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  // Soft delete: other records reference users, and a hard delete would orphan or cascade away real history.
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
