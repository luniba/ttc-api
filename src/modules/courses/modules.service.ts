import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { basename, extname } from 'path';
import { DataSource, Repository, type EntityManager } from 'typeorm';
import { ErrorCode } from '../../common/constants/error-codes';
import { detectDocumentType } from '../../common/utils/document-signature';
import { StorageService } from '../../storage/storage.service';
import { sanitizeContent } from './content-sanitizer';
import {
  toMaterialDto,
  toModuleDto,
  toModuleSummary,
  type MaterialDto,
  type ModuleDto,
  type ModuleSummary,
} from './courses.mappers';
import type { CreateLinkMaterialDto } from './dto/material.dto';
import type {
  CheckQuizDto,
  CreateModuleDto,
  ReorderModulesDto,
  ReplaceQuestionsDto,
  UpdateModuleDto,
} from './dto/module.dto';
import { CourseModule, ModuleType } from './entities/course-module.entity';
import { Course } from './entities/course.entity';
import { MaterialType, ModuleMaterial } from './entities/module-material.entity';
import { QuizQuestion } from './entities/quiz-question.entity';
import { scoreQuiz, type QuizResult } from './quiz-score';

// ~10 minutes: long enough to start a download, short enough that a shared link goes stale.
const DOWNLOAD_URL_TTL_SECONDS = 600;

// Display/download name only (never the storage key): strip any path, control and quote characters, cap at the column width.
const sanitizeFileName = (name: string): string => {
  const cleaned = basename(name.replace(/\\/g, '/'))
    .replace(/[\p{Cc}"<>|:*?]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= 255) return cleaned || 'file';
  const ext = extname(cleaned).slice(0, 10);
  return cleaned.slice(0, 255 - ext.length) + ext;
};

@Injectable()
export class ModulesService {
  private readonly logger = new Logger(ModulesService.name);

  constructor(
    @InjectRepository(CourseModule) private readonly repo: Repository<CourseModule>,
    @InjectRepository(Course) private readonly courses: Repository<Course>,
    @InjectRepository(ModuleMaterial) private readonly materials: Repository<ModuleMaterial>,
    private readonly storage: StorageService,
    private readonly dataSource: DataSource,
  ) {}

  private sign = (key: string, fileName: string): Promise<string> =>
    this.storage.getPrivateDownloadUrl(key, fileName, DOWNLOAD_URL_TTL_SECONDS);

  // ---- Modules -------------------------------------------------------------

  async findSummaries(courseId: string, manager: EntityManager = this.repo.manager): Promise<ModuleSummary[]> {
    const modules = await manager
      .getRepository(CourseModule)
      .createQueryBuilder('module')
      .loadRelationCountAndMap('module.materialCount', 'module.materials')
      .loadRelationCountAndMap('module.questionCount', 'module.questions')
      .where('module.courseId = :courseId', { courseId })
      .orderBy('module.position', 'ASC')
      .getMany();
    return modules.map(toModuleSummary);
  }

  async findAllForCourse(courseId: string): Promise<ModuleSummary[]> {
    await this.assertCourseExists(courseId);
    return this.findSummaries(courseId);
  }

  async findOne(id: string): Promise<ModuleDto> {
    return toModuleDto(await this.getWithMaterials(id), this.sign, true);
  }

  // Public preview: published course, module belongs to it, and it's a preview module (or the caller is an admin).
  async findOnePublic(courseSlug: string, moduleId: string, isAdmin: boolean): Promise<ModuleDto> {
    const module = await this.loadPublic(courseSlug, moduleId, isAdmin);
    // A preview quiz is for trying, so its answers stay on the server.
    return toModuleDto(module, this.sign, isAdmin);
  }

  // Scores a try at a quiz the caller may read. Says which answers were right, never what the
  // right answers are, so a preview quiz can be retried honestly.
  async checkQuiz(courseSlug: string, moduleId: string, dto: CheckQuizDto, isAdmin: boolean): Promise<QuizResult> {
    const module = await this.loadPublic(courseSlug, moduleId, isAdmin);
    if (module.type !== ModuleType.QUIZ) throw new BadRequestException('This module is not a quiz');
    const correct = [...module.questions].sort((a, b) => a.position - b.position).map((q) => q.correctIndex);
    if (dto.answers.length !== correct.length) {
      throw new BadRequestException(`Answer all ${correct.length} questions. Refresh if the quiz has changed.`);
    }
    return scoreQuiz(correct, dto.answers);
  }

  private async loadPublic(courseSlug: string, moduleId: string, isAdmin: boolean): Promise<CourseModule> {
    const module = await this.repo
      .createQueryBuilder('module')
      .innerJoin('module.course', 'course')
      .leftJoinAndSelect('module.materials', 'material')
      .leftJoinAndSelect('module.questions', 'question')
      .where('module.id = :moduleId', { moduleId })
      .andWhere('course.slug = :courseSlug AND course.isPublished = true', { courseSlug })
      .getOne();
    if (!module) throw new NotFoundException('Module not found');

    if (!module.isPreview && !isAdmin) {
      throw new ForbiddenException({
        message: 'This module is only available to enrolled students',
        error: 'Forbidden',
        code: ErrorCode.MODULE_LOCKED,
      });
    }
    return module;
  }

  async create(courseId: string, dto: CreateModuleDto): Promise<ModuleDto> {
    await this.assertCourseExists(courseId);

    const module = await this.repo.save(
      this.repo.create({
        courseId,
        title: dto.title,
        type: dto.type ?? ModuleType.LESSON,
        content: sanitizeContent(dto.content ?? ''),
        durationMinutes: dto.durationMinutes ?? 0,
        isPreview: dto.isPreview ?? false,
        position: await this.nextPosition(this.repo, 'courseId', courseId),
      }),
    );
    return this.findOne(module.id);
  }

  async update(id: string, dto: UpdateModuleDto): Promise<ModuleDto> {
    const module = await this.repo.findOne({ where: { id } });
    if (!module) throw new NotFoundException('Module not found');

    if (dto.title !== undefined) module.title = dto.title;
    if (dto.content !== undefined) module.content = sanitizeContent(dto.content);
    if (dto.durationMinutes !== undefined) module.durationMinutes = dto.durationMinutes;
    if (dto.isPreview !== undefined) module.isPreview = dto.isPreview;

    await this.repo.save(module);
    return this.findOne(id);
  }

  // Positions rewritten in one transaction so a drag lands completely or not at all. The id set must be exactly the course's
  // modules — a stale client (module added/removed elsewhere) gets a 400 instead of a silently scrambled order.
  async reorder(courseId: string, dto: ReorderModulesDto): Promise<ModuleSummary[]> {
    await this.assertCourseExists(courseId);

    return this.dataSource.transaction(async (manager) => {
      const current = await manager.find(CourseModule, {
        where: { courseId },
        select: { id: true },
        lock: { mode: 'pessimistic_write' },
      });
      const currentIds = new Set(current.map((module) => module.id));
      const sameSet =
        currentIds.size === dto.moduleIds.length && dto.moduleIds.every((id) => currentIds.has(id));
      if (!sameSet) {
        throw new BadRequestException(
          "moduleIds must contain exactly this course's modules. Refresh and try again.",
        );
      }

      for (const [position, id] of dto.moduleIds.entries()) {
        await manager.update(CourseModule, { id, courseId }, { position });
      }
      return this.findSummaries(courseId, manager);
    });
  }

  // Hard delete; materials go with it via FK cascade, then their files are removed (best effort — an orphaned object is
  // harmless and logged, a failed request after the row is gone would not be).
  async remove(id: string): Promise<{ message: string }> {
    const module = await this.repo.findOne({ where: { id }, relations: { materials: true } });
    if (!module) throw new NotFoundException('Module not found');

    await this.repo.delete(id);
    await Promise.all(
      module.materials.filter((m) => m.fileKey).map((m) => this.deleteFile(m.fileKey!)),
    );
    return { message: 'Module deleted' };
  }

  // ---- Quiz questions ------------------------------------------------------

  // The quiz page saves its whole list at once, so this replaces every question in one transaction.
  async replaceQuestions(moduleId: string, dto: ReplaceQuestionsDto): Promise<ModuleDto> {
    const module = await this.repo.findOne({ where: { id: moduleId } });
    if (!module) throw new NotFoundException('Module not found');
    if (module.type !== ModuleType.QUIZ) {
      throw new BadRequestException('Only quiz modules have questions');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(QuizQuestion, { moduleId });
      if (dto.questions.length) {
        await manager.insert(
          QuizQuestion,
          dto.questions.map((q, position) => ({ moduleId, ...q, position })),
        );
      }
    });
    return this.findOne(moduleId);
  }

  // ---- Materials -----------------------------------------------------------

  async addFile(moduleId: string, file: Express.Multer.File, title?: string): Promise<MaterialDto> {
    await this.assertModuleExists(moduleId);

    const fileName = sanitizeFileName(file.originalname);
    const type = detectDocumentType(file.buffer, fileName);
    if (!type) {
      throw new UnsupportedMediaTypeException(
        'Only PDF, Word (.doc/.docx) and PowerPoint (.ppt/.pptx) files are allowed, and the content must match the extension.',
      );
    }

    const stored = await this.storage.uploadPrivate({
      buffer: file.buffer,
      // Only the sniffed extension reaches the key.
      filename: `file.${type.ext}`,
      mimeType: type.mimeType,
      folder: 'materials',
    });

    try {
      const material = await this.materials.save(
        this.materials.create({
          moduleId,
          type: MaterialType.FILE,
          title: (title || fileName.slice(0, fileName.length - extname(fileName).length) || fileName).slice(0, 200),
          fileKey: stored.key,
          fileName,
          mimeType: type.mimeType,
          sizeBytes: stored.size,
          url: null,
          position: await this.nextPosition(this.materials, 'moduleId', moduleId),
        }),
      );
      return toMaterialDto(material, this.sign);
    } catch (error) {
      // Don't leave an unreferenced paid file behind (e.g. the module was deleted mid-upload).
      await this.deleteFile(stored.key);
      throw error;
    }
  }

  async addLink(moduleId: string, dto: CreateLinkMaterialDto): Promise<MaterialDto> {
    await this.assertModuleExists(moduleId);

    const material = await this.materials.save(
      this.materials.create({
        moduleId,
        type: MaterialType.LINK,
        title: dto.title,
        url: dto.url,
        fileKey: null,
        fileName: null,
        mimeType: null,
        sizeBytes: null,
        position: await this.nextPosition(this.materials, 'moduleId', moduleId),
      }),
    );
    return toMaterialDto(material, this.sign);
  }

  async removeMaterial(id: string): Promise<{ message: string }> {
    const material = await this.materials.findOne({ where: { id } });
    if (!material) throw new NotFoundException('Material not found');

    await this.materials.delete(id);
    if (material.fileKey) await this.deleteFile(material.fileKey);
    return { message: 'Material deleted' };
  }

  // ---- Helpers -------------------------------------------------------------

  private async getWithMaterials(id: string): Promise<CourseModule> {
    const module = await this.repo.findOne({ where: { id }, relations: { materials: true, questions: true } });
    if (!module) throw new NotFoundException('Module not found');
    return module;
  }

  private async assertCourseExists(courseId: string): Promise<void> {
    if (!(await this.courses.existsBy({ id: courseId }))) {
      throw new NotFoundException('Course not found');
    }
  }

  // Materials belong to lessons; a quiz has questions instead.
  private async assertModuleExists(moduleId: string): Promise<void> {
    const module = await this.repo.findOne({ where: { id: moduleId }, select: { id: true, type: true } });
    if (!module) throw new NotFoundException('Module not found');
    if (module.type === ModuleType.QUIZ) {
      throw new BadRequestException('Quizzes have questions, not materials');
    }
  }

  // Appends after the current last item. ponytail: two concurrent appends can share a position; harmless (ties sort arbitrarily, next reorder fixes it).
  private async nextPosition(
    repo: Repository<CourseModule> | Repository<ModuleMaterial>,
    column: 'courseId' | 'moduleId',
    parentId: string,
  ): Promise<number> {
    const row = await (repo as Repository<CourseModule>)
      .createQueryBuilder('row')
      .select('MAX(row.position)', 'max')
      .where(`row.${column} = :parentId`, { parentId })
      .getRawOne<{ max: number | null }>();
    return (row?.max ?? -1) + 1;
  }

  private async deleteFile(key: string): Promise<void> {
    try {
      await this.storage.deletePrivate(key);
    } catch (error) {
      this.logger.warn(
        `Failed to delete material file "${key}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
