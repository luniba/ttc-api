import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Course } from '../../courses/entities/course.entity';
import { User } from '../../users/entities/user.entity';

// The student may read all modules of this course; granted by an admin.
@Entity('enrolments')
@Index('uq_enrolments_user_course', ['userId', 'courseId'], { unique: true })
export class Enrolment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_enrolments_user' })
  user!: User;

  @Index('idx_enrolments_course_id')
  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string;

  // RESTRICT: keep courses that have students.
  @ManyToOne(() => Course, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'course_id', foreignKeyConstraintName: 'fk_enrolments_course' })
  course!: Course;

  // Null if that admin account is removed.
  @Column({ name: 'granted_by', type: 'uuid', nullable: true })
  grantedBy!: string | null;

  @CreateDateColumn({ name: 'granted_at', type: 'timestamptz' })
  grantedAt!: Date;
}
