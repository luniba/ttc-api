import type { CourseCategory } from './entities/course-category.entity';
import type { CourseModule, ModuleType } from './entities/course-module.entity';
import type { Course } from './entities/course.entity';
import { MaterialType, type ModuleMaterial } from './entities/module-material.entity';
import type { QuizQuestion } from './entities/quiz-question.entity';

// Explicit allow-lists rather than returning entities, so a new column doesn't leak the day it's added. Shapes are the contract in docs/courses-api.md.
export type UrlResolver = (key: string) => string;
export type SignedUrlResolver = (key: string, fileName: string) => Promise<string>;

export interface CategoryDto {
  id: string;
  name: string;
  slug: string;
}

export interface CourseDto {
  id: string;
  slug: string;
  title: string;
  category: CategoryDto;
  duration: string;
  level: string;
  studentCount: string;
  description: string;
  price: number;
  /** Admin responses only. */
  thumbnailKey?: string | null;
  thumbnailUrl: string | null;
  isPublished: boolean;
  moduleCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModuleSummary {
  id: string;
  title: string;
  type: ModuleType;
  durationMinutes: number;
  isPreview: boolean;
  position: number;
  materialCount: number;
  questionCount: number;
}

export interface QuizQuestionDto {
  id: string;
  prompt: string;
  options: string[];
  /** Admin responses only — the public site never gets the answers. */
  correctIndex?: number;
}

export interface CourseDetailDto extends CourseDto {
  modules: ModuleSummary[];
}

export interface MaterialDto {
  id: string;
  type: MaterialType;
  title: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  /** file: signed URL (~10 min); link: the stored URL. */
  url: string;
}

export interface ModuleDto extends ModuleSummary {
  courseId: string;
  content: string;
  materials: MaterialDto[];
  questions: QuizQuestionDto[];
  createdAt: Date;
  updatedAt: Date;
}

export const toCategoryDto = (category: CourseCategory): CategoryDto => ({
  id: category.id,
  name: category.name,
  slug: category.slug,
});

export const toCourseDto = (course: Course, url: UrlResolver, admin: boolean): CourseDto => ({
  id: course.id,
  slug: course.slug,
  title: course.title,
  category: toCategoryDto(course.category),
  duration: course.duration,
  level: course.level,
  studentCount: course.studentCount,
  description: course.description,
  price: course.price,
  ...(admin ? { thumbnailKey: course.thumbnailKey } : {}),
  thumbnailUrl: course.thumbnailKey ? url(course.thumbnailKey) : null,
  isPublished: course.isPublished,
  moduleCount: course.moduleCount ?? 0,
  createdAt: course.createdAt,
  updatedAt: course.updatedAt,
});

export const toModuleSummary = (module: CourseModule): ModuleSummary => ({
  id: module.id,
  title: module.title,
  type: module.type,
  durationMinutes: module.durationMinutes,
  isPreview: module.isPreview,
  position: module.position,
  materialCount: module.materialCount ?? module.materials?.length ?? 0,
  questionCount: module.questionCount ?? module.questions?.length ?? 0,
});

export const toMaterialDto = async (
  material: ModuleMaterial,
  sign: SignedUrlResolver,
): Promise<MaterialDto> => ({
  id: material.id,
  type: material.type,
  title: material.title,
  fileName: material.fileName,
  mimeType: material.mimeType,
  sizeBytes: material.sizeBytes,
  url:
    material.type === MaterialType.FILE
      ? await sign(material.fileKey!, material.fileName ?? material.title)
      : material.url!,
});

const toQuestionDto = (q: QuizQuestion, withAnswers: boolean): QuizQuestionDto => ({
  id: q.id,
  prompt: q.prompt,
  options: q.options,
  ...(withAnswers ? { correctIndex: q.correctIndex } : {}),
});

// withAnswers: true for admins only.
export const toModuleDto = async (
  module: CourseModule,
  sign: SignedUrlResolver,
  withAnswers: boolean,
): Promise<ModuleDto> => {
  const materials = [...(module.materials ?? [])].sort((a, b) => a.position - b.position);
  const questions = [...(module.questions ?? [])].sort((a, b) => a.position - b.position);
  return {
    ...toModuleSummary(module),
    courseId: module.courseId,
    content: module.content,
    materials: await Promise.all(materials.map((material) => toMaterialDto(material, sign))),
    questions: questions.map((q) => toQuestionDto(q, withAnswers)),
    createdAt: module.createdAt,
    updatedAt: module.updatedAt,
  };
};
