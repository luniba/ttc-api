import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CategoriesService } from './categories.service';
import type { CategoryDto } from './courses.mappers';
import { CreateCategoryDto } from './dto/category.dto';

@ApiTags('admin: course categories')
@ApiBearerAuth('access-token')
@ApiForbiddenResponse({ description: 'Caller is not an admin.' })
@Roles(UserRole.ADMIN)
@Controller('admin/course-categories')
export class CategoriesAdminController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List course categories (name asc)' })
  findAll(): Promise<CategoryDto[]> {
    return this.categories.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a course category', description: 'Slug is derived from the name.' })
  @ApiConflictResponse({ description: 'CATEGORY_TAKEN — a category with this name (case-insensitive) exists.' })
  create(@Body() dto: CreateCategoryDto): Promise<CategoryDto> {
    return this.categories.create(dto);
  }
}
