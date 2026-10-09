import { Check, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CourseModule } from './course-module.entity';

// One multiple-choice question in a quiz module: exactly four options, one of them correct.
@Entity('quiz_questions')
@Index('idx_quiz_questions_module_position', ['moduleId', 'position'])
@Check('chk_quiz_questions_options', '(cardinality(options) = 4)')
@Check('chk_quiz_questions_correct_index', '((correct_index >= 0) AND (correct_index <= 3))')
export class QuizQuestion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'module_id', type: 'uuid' })
  moduleId!: string;

  @ManyToOne(() => CourseModule, (module) => module.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'module_id' })
  module!: CourseModule;

  @Column({ type: 'varchar', length: 1000 })
  prompt!: string;

  // In display order, A to D.
  @Column({ type: 'text', array: true })
  options!: string[];

  // 0–3 into options. Admin responses only; never sent to the public site.
  @Column({ name: 'correct_index', type: 'smallint' })
  correctIndex!: number;

  @Column({ type: 'int' })
  position!: number;
}
