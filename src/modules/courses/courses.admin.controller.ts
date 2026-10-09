import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import type { Paginated } from '../../common/types/api-response';
import { UserRole } from '../users/entities/user.entity';
import type { CourseDto } from './courses.mappers';
import { CoursesService } from './courses.service';
import { CourseAdminQueryDto, CreateCourseDto, UpdateCourseDto } from './dto/course.dto';

@ApiTags('admin: courses')
@ApiBearerAuth('access-token')
@ApiForbiddenResponse({ description: 'Caller is not an admin.' })
@Roles(UserRole.ADMIN)
@Controller('admin/courses')
export class CoursesAdminController {
  constructor(private readonly courses: CoursesService) {}

  @Get()
  @ApiOperation({
    summary: 'List courses, drafts included',
    description: 'Newest first. `q` searches the title. Counts arrive in `meta.pagination`.',
  })
  findAll(@Query() query: CourseAdminQueryDto): Promise<Paginated<CourseDto>> {
    return this.courses.findAllAdmin(query);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a course',
    description: 'Slug derived from the title when omitted (-2, -3 on clash). Unknown category → 400.',
  })
  @ApiConflictResponse({ description: 'SLUG_TAKEN — the explicit slug is in use (soft-deleted courses included).' })
  create(@Body() dto: CreateCourseDto): Promise<CourseDto> {
    return this.courses.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a course' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<CourseDto> {
    return this.courses.findOneAdmin(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a course', description: '`thumbnailKey`: omit to keep, null to clear.' })
  @ApiConflictResponse({ description: 'SLUG_TAKEN' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCourseDto): Promise<CourseDto> {
    return this.courses.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a course', description: 'Modules and materials are kept.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.courses.remove(id);
  }
}
