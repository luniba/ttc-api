import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ErrorCode } from '../../common/constants/error-codes';
import { uniqueSlug } from '../../common/utils/slug';
import { toCategoryDto, type CategoryDto } from './courses.mappers';
import type { CreateCategoryDto } from './dto/category.dto';
import { CourseCategory } from './entities/course-category.entity';

const categoryTaken = (name: string) =>
  new ConflictException({
    message: `A category named "${name}" already exists`,
    error: 'Conflict',
    code: ErrorCode.CATEGORY_TAKEN,
  });

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(CourseCategory)
    private readonly repo: Repository<CourseCategory>,
  ) {}

  async findAll(): Promise<CategoryDto[]> {
    const categories = await this.repo.find({ order: { name: 'ASC' } });
    return categories.map(toCategoryDto);
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDto> {
    const taken = await this.repo
      .createQueryBuilder('category')
      .where('LOWER(category.name) = LOWER(:name)', { name: dto.name })
      .getExists();
    if (taken) throw categoryTaken(dto.name);

    const slug = await uniqueSlug(dto.name, (candidate) => this.repo.existsBy({ slug: candidate }));

    try {
      return toCategoryDto(await this.repo.save(this.repo.create({ name: dto.name, slug })));
    } catch (error) {
      // Two concurrent "add category" submits: the second loses on the unique index rather than the pre-check.
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23505') {
        throw categoryTaken(dto.name);
      }
      throw error;
    }
  }
}
