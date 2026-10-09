import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CourseModule } from './course-module.entity';

export enum MaterialType {
  FILE = 'file',
  LINK = 'link',
}

@Entity('module_materials')
@Index('idx_module_materials_module_position', ['moduleId', 'position'])
export class ModuleMaterial {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'module_id', type: 'uuid' })
  moduleId!: string;

  @ManyToOne(() => CourseModule, (module) => module.materials, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'module_id' })
  module!: CourseModule;

  @Column({ type: 'enum', enum: MaterialType })
  type!: MaterialType;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  // file: key in the PRIVATE bucket. Paid content — only ever handed out as a short-lived signed URL.
  @Column({ name: 'file_key', type: 'varchar', length: 512, nullable: true })
  fileKey!: string | null;

  // Sanitised original name, for display and the download's Content-Disposition. Never part of the storage key.
  @Column({ name: 'file_name', type: 'varchar', length: 255, nullable: true })
  fileName!: string | null;

  // Sniffed from the bytes, not the client's claim.
  @Column({ name: 'mime_type', type: 'varchar', length: 120, nullable: true })
  mimeType!: string | null;

  @Column({ name: 'size_bytes', type: 'int', nullable: true })
  sizeBytes!: number | null;

  // link: https URL (video or external resource).
  @Column({ type: 'varchar', length: 2048, nullable: true })
  url!: string | null;

  @Column({ type: 'int' })
  position!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
