import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, QueryFailedError, Repository, type SelectQueryBuilder } from 'typeorm';
import { ErrorCode } from '../../common/constants/error-codes';
import { Paginated } from '../../common/types/api-response';
import { escapeLike } from '../../common/utils/escape-like';
import { slugify, uniqueSlug } from '../../common/utils/slug';
import { StorageService } from '../../storage/storage.service';
import {
  toCourseDto,
  toModuleSummary,
  type CourseDetailDto,
  type CourseDto,
} from './courses.mappers';
import {
  CourseStatus,
  type CourseAdminQueryDto,
  type CreateCourseDto,
  type UpdateCourseDto,
} from './dto/course.dto';
import { CourseCategory } from './entities/course-category.entity';
import { CourseModule } from './entities/course-module.entity';
import { Course } from './entities/course.entity';

const slugTaken = (slug: string) =>
  new ConflictException({
    message: `The slug "${slug}" is already in use`,
    error: 'Conflict',
    code: ErrorCode.SLUG_TAKEN,
  });

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23505';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course) private readonly repo: Repository<Course>,
    @InjectRepository(CourseCategory) private readonly categories: Repository<CourseCategory>,
    @InjectRepository(CourseModule) private readonly modules: Repository<CourseModule>,
    private readonly storage: StorageService,
  ) {}

  private url = (key: string): string => this.storage.getUrl(key);

  // Category + module count in the same round trip (count is one grouped query for the whole page, not one per course).
  private query(): SelectQueryBuilder<Course> {
    return this.repo
      .createQueryBuilder('course')
      .innerJoinAndSelect('course.category', 'category')
      .loadRelationCountAndMap('course.moduleCount', 'course.modules');
  }

  async findAllAdmin(query: CourseAdminQueryDto): Promise<Paginated<CourseDto>> {
    const qb = this.query();

    if (query.status !== CourseStatus.ALL) {
      qb.andWhere('course.isPublished = :published', {
        published: query.status === CourseStatus.PUBLISHED,
      });
    }

    const term = query.q?.trim();
    if (term) {
      qb.andWhere('course.title ILIKE :term', { term: `%${escapeLike(term)}%` });
    }

    // id tie-break so equal timestamps can't swap between pages.
    qb.orderBy('course.createdAt', 'DESC').addOrderBy('course.id', 'ASC');

    const [courses, total] = await qb.take(query.limit).skip(query.skip).getManyAndCount();
    return new Paginated(
      courses.map((course) => toCourseDto(course, this.url, true)),
      total,
      query.page,
      query.limit,
    );
  }

  async findOneAdmin(id: string): Promise<CourseDto> {
    return toCourseDto(await this.getOrFail(id), this.url, true);
  }

  // Not paginated: the public catalogue is a handful of courses rendered on one page.
  async findAllPublic(): Promise<CourseDto[]> {
    const courses = await this.query()
      .where('course.isPublished = true')
      .orderBy('course.createdAt', 'DESC')
      .addOrderBy('course.id', 'ASC')
      .getMany();
    return courses.map((course) => toCourseDto(course, this.url, false));
  }

  async findOnePublic(slug: string): Promise<CourseDetailDto> {
    const course = await this.query()
      .where('course.slug = :slug AND course.isPublished = true', { slug })
      .getOne();
    if (!course) throw new NotFoundException('Course not found');

    const modules = await this.modules
      .createQueryBuilder('module')
      .loadRelationCountAndMap('module.materialCount', 'module.materials')
      .loadRelationCountAndMap('module.questionCount', 'module.questions')
      .where('module.courseId = :courseId', { courseId: course.id })
      .orderBy('module.position', 'ASC')
      .getMany();

    return { ...toCourseDto(course, this.url, false), modules: modules.map(toModuleSummary) };
  }

  async create(dto: CreateCourseDto): Promise<CourseDto> {
    await this.assertCategoryExists(dto.categoryId);

    const slug = dto.slug
      ? await this.assertSlugFree(dto.slug)
      : // Leaves room for a "-NNN" suffix inside varchar(160).
        await uniqueSlug(dto.title.slice(0, 150), (candidate) => this.slugExists(candidate));

    const course = this.repo.create({
      slug,
      title: dto.title,
      categoryId: dto.categoryId,
      duration: dto.duration,
      level: dto.level,
      studentCount: dto.studentCount,
      description: dto.description,
      price: dto.price,
      thumbnailKey: dto.thumbnailKey ?? null,
      isPublished: dto.isPublished ?? false,
    });

    const saved = await this.save(course, slug);
    return this.findOneAdmin(saved.id);
  }

  async update(id: string, dto: UpdateCourseDto): Promise<CourseDto> {
    const course = await this.repo.findOne({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');

    if (dto.categoryId !== undefined) {
      await this.assertCategoryExists(dto.categoryId);
      course.categoryId = dto.categoryId;
    }
    // Renaming never regenerates the slug — inbound links are attached to it. Only an explicit slug changes it.
    if (dto.slug !== undefined) course.slug = await this.assertSlugFree(dto.slug, id);
    if (dto.title !== undefined) course.title = dto.title;
    if (dto.duration !== undefined) course.duration = dto.duration;
    if (dto.level !== undefined) course.level = dto.level;
    if (dto.studentCount !== undefined) course.studentCount = dto.studentCount;
    if (dto.description !== undefined) course.description = dto.description;
    if (dto.price !== undefined) course.price = dto.price;
    // Tri-state: omitted = leave, null = clear, string = set.
    if (dto.thumbnailKey !== undefined) course.thumbnailKey = dto.thumbnailKey;
    if (dto.isPublished !== undefined) course.isPublished = dto.isPublished;

    await this.save(course, course.slug);
    return this.findOneAdmin(id);
  }

  // Soft delete only: modules, materials and files stay, so the course can be restored.
  async remove(id: string): Promise<{ message: string }> {
    const exists = await this.repo.existsBy({ id });
    if (!exists) throw new NotFoundException('Course not found');

    await this.repo.softDelete(id);
    return { message: 'Course deleted' };
  }

  async getOrFail(id: string): Promise<Course> {
    const course = await this.query().where('course.id = :id', { id }).getOne();
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  private async save(course: Course, slug: string): Promise<Course> {
    try {
      return await this.repo.save(course);
    } catch (error) {
      // A concurrent create took the slug between the check and the insert.
      if (isUniqueViolation(error)) throw slugTaken(slug);
      throw error;
    }
  }

  private async assertCategoryExists(categoryId: string): Promise<void> {
    if (!(await this.categories.existsBy({ id: categoryId }))) {
      throw new BadRequestException(`No category with id "${categoryId}"`);
    }
  }

  // Doesn't de-duplicate: the caller asked for this exact slug, so silently handing back another would hide the clash.
  private async assertSlugFree(source: string, excludeId?: string): Promise<string> {
    const slug = slugify(source);
    if (!slug) throw new BadRequestException('Slug must contain at least one letter or number');
    if (await this.slugExists(slug, excludeId)) throw slugTaken(slug);
    return slug;
  }

  /** Includes soft-deleted courses: their slugs still occupy the unique index. */
  private slugExists(slug: string, excludeId?: string): Promise<boolean> {
    return this.repo.exists({
      where: excludeId ? { slug, id: Not(excludeId) } : { slug },
      withDeleted: true,
    });
  }
}
