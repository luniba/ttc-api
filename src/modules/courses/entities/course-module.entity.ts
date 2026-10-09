import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Course } from './course.entity';
import { ModuleMaterial } from './module-material.entity';
import { QuizQuestion } from './quiz-question.entity';

// A lesson has rich-text content and materials; a quiz has multiple-choice questions.
export enum ModuleType {
  LESSON = 'lesson',
  QUIZ = 'quiz',
}

@Entity('course_modules')
@Check('chk_course_modules_duration_minutes', '(duration_minutes >= 0)')
// Not unique: a reorder rewrites every position inside one transaction and would trip a non-deferred unique constraint midway.
@Index('idx_course_modules_course_position', ['courseId', 'position'])
export class CourseModule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId!: string;

  @ManyToOne(() => Course, (course) => course.modules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course!: Course;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  // Chosen when the module is created and never changed: a lesson's materials and a quiz's
  // questions don't convert into each other.
  @Column({ type: 'enum', enum: ModuleType, enumName: 'course_module_type_enum', default: ModuleType.LESSON })
  type!: ModuleType;

  // Sanitised HTML (see content-sanitizer.ts) — never stored raw.
  @Column({ type: 'text', default: '' })
  content!: string;

  @Column({ name: 'duration_minutes', type: 'int', default: 0 })
  durationMinutes!: number;

  // Readable without login or payment, materials included.
  @Column({ name: 'is_preview', type: 'boolean', default: false })
  isPreview!: boolean;

  @Column({ type: 'int' })
  position!: number;

  @OneToMany(() => ModuleMaterial, (material) => material.module)
  materials!: ModuleMaterial[];

  @OneToMany(() => QuizQuestion, (question) => question.module)
  questions!: QuizQuestion[];

  // Filled by loadRelationCountAndMap; not columns.
  materialCount?: number;
  questionCount?: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
