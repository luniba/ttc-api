import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CategoriesService } from './categories.service';
import type { CategoryDto } from './courses.mappers';

@ApiTags('courses')
@Public()
@Controller('course-categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Public course categories (name asc)' })
  findAll(): Promise<CategoryDto[]> {
    return this.categories.findAll();
  }
}
