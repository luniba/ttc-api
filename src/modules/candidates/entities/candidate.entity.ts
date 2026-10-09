import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Course } from '../../courses/entities/course.entity';

// A certificate holder, recorded by an admin. Not a login account.
@Entity('candidates')
@Index('idx_candidates_created_at', ['createdAt'])
export class Candidate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Generated on create ("kuqwc-tesoltefl-35620"), never edited. Plain unique index, so a
  // soft-deleted candidate's ID is never handed to someone else.
  @Index('uq_candidates_certificate_id', { unique: true })
  @Column({ name: 'certificate_id', type: 'varchar', length: 40 })
  certificateId!: string;

  // Typed by the admin from the printed certificate.
  @Index('uq_candidates_certificate_no', { unique: true })
  @Column({ name: 'certificate_no', type: 'varchar', length: 60 })
  certificateNo!: string;

  @Column({ name: 'passport_name', type: 'varchar', length: 160 })
  passportName!: string;

  @Column({ name: 'passport_no', type: 'varchar', length: 40 })
  passportNo!: string;

  // 'date' columns come back from TypeORM as "YYYY-MM-DD" strings: no time zone to shift them.
  @Column({ name: 'date_of_birth', type: 'date' })
  dateOfBirth!: string;

  @Column({ type: 'varchar', length: 500 })
  address!: string;

  @Column({ type: 'varchar', length: 254 })
  email!: string;

  @Index('idx_candidates_course_id')
  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string;

  // RESTRICT: a course with certificate holders can't be hard-deleted out from under them
  // (courses are only ever soft-deleted anyway).
  @ManyToOne(() => Course, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'course_id' })
  course!: Course;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate!: string;

  @Column({ type: 'varchar', length: 80 })
  nationality!: string;

  // Set from the Verification page (POST /admin/candidates/:id/verify), never by the form.
  @Index('idx_candidates_is_verified')
  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified!: boolean;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
