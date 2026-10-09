import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Course } from './course.entity';

// Flat and append-only for now (no edit/delete endpoints), so no soft delete.
@Entity('course_categories')
export class CourseCategory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Case-insensitive uniqueness is a unique index on lower(name), which the differ can't express — the migration owns it, synchronize:false stops churn.
  @Index('uq_course_categories_name_lower', { synchronize: false })
  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Index('uq_course_categories_slug', { unique: true })
  @Column({ type: 'varchar', length: 100 })
  slug!: string;

  @OneToMany(() => Course, (course) => course.category)
  courses!: Course[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
