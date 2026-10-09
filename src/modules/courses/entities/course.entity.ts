import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { numericTransformer } from '../../../common/transformers/numeric.transformer';
import { CourseCategory } from './course-category.entity';
import { CourseModule } from './course-module.entity';

@Entity('courses')
@Index('idx_courses_published_created_at', ['isPublished', 'createdAt'])
// Normalized form (`(0)::numeric`) so the schema differ sees it as unchanged.
@Check('chk_courses_price', '(price >= (0)::numeric)')
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Plain unique index, so soft-deleted courses keep their slug (inbound links never get reassigned to a different course).
  @Index('uq_courses_slug', { unique: true })
  @Column({ type: 'varchar', length: 160 })
  slug!: string;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Index('idx_courses_category_id')
  @Column({ name: 'category_id', type: 'uuid' })
  categoryId!: string;

  // RESTRICT: removing a category must never take its courses with it.
  @ManyToOne(() => CourseCategory, (category) => category.courses, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category!: CourseCategory;

  // Free text ("Lifetime access", "5 weeks"), shown as-is.
  @Column({ type: 'varchar', length: 80 })
  duration!: string;

  @Column({ type: 'varchar', length: 80 })
  level!: string;

  // Marketing copy ("5,000+"), not a computed enrolment count.
  @Column({ name: 'student_count', type: 'varchar', length: 40 })
  studentCount!: string;

  // Plain text; blank-line separated paragraphs.
  @Column({ type: 'text' })
  description!: string;

  // USD. numeric, not float, so money never rounds.
  @Column({ type: 'numeric', precision: 10, scale: 2, transformer: numericTransformer })
  price!: number;

  // Storage key in the public bucket, not a URL.
  @Column({ name: 'thumbnail_key', type: 'varchar', length: 512, nullable: true })
  thumbnailKey!: string | null;

  @Column({ name: 'is_published', type: 'boolean', default: false })
  isPublished!: boolean;

  @OneToMany(() => CourseModule, (module) => module.course)
  modules!: CourseModule[];

  // Filled by loadRelationCountAndMap; not a column.
  moduleCount?: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
