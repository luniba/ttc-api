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
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import type { ModuleDto, ModuleSummary } from './courses.mappers';
import { CreateModuleDto, ReorderModulesDto, ReplaceQuestionsDto, UpdateModuleDto } from './dto/module.dto';
import { ModulesService } from './modules.service';

@ApiTags('admin: course modules')
@ApiBearerAuth('access-token')
@ApiForbiddenResponse({ description: 'Caller is not an admin.' })
@Roles(UserRole.ADMIN)
@Controller('admin')
export class ModulesAdminController {
  constructor(private readonly modules: ModulesService) {}

  @Get('courses/:id/modules')
  @ApiOperation({ summary: "List a course's modules (position asc)" })
  findAll(@Param('id', ParseUUIDPipe) courseId: string): Promise<ModuleSummary[]> {
    return this.modules.findAllForCourse(courseId);
  }

  @Post('courses/:id/modules')
  @ApiOperation({ summary: 'Add a module (appended last)', description: '`content` HTML is sanitised server-side.' })
  create(@Param('id', ParseUUIDPipe) courseId: string, @Body() dto: CreateModuleDto): Promise<ModuleDto> {
    return this.modules.create(courseId, dto);
  }

  // Declared before any `courses/:id/modules/:x` route could shadow it; Nest matches in declaration order.
  @Patch('courses/:id/modules/order')
  @ApiOperation({ summary: 'Reorder modules', description: "`moduleIds` must be exactly this course's module ids." })
  @ApiBadRequestResponse({ description: "The id set differs from the course's modules." })
  reorder(
    @Param('id', ParseUUIDPipe) courseId: string,
    @Body() dto: ReorderModulesDto,
  ): Promise<ModuleSummary[]> {
    return this.modules.reorder(courseId, dto);
  }

  @Get('modules/:moduleId')
  @ApiOperation({ summary: 'Get a module with content and materials' })
  findOne(@Param('moduleId', ParseUUIDPipe) id: string): Promise<ModuleDto> {
    return this.modules.findOne(id);
  }

  @Patch('modules/:moduleId')
  @ApiOperation({ summary: 'Update a module', description: '`content` HTML is sanitised server-side.' })
  update(@Param('moduleId', ParseUUIDPipe) id: string, @Body() dto: UpdateModuleDto): Promise<ModuleDto> {
    return this.modules.update(id, dto);
  }

  @Put('modules/:moduleId/questions')
  @ApiOperation({
    summary: "Replace a quiz's questions",
    description: 'The full list in order; whatever was there before is replaced. Each question: 4 different options, correctIndex 0–3. Lesson modules → 400.',
  })
  replaceQuestions(
    @Param('moduleId', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceQuestionsDto,
  ): Promise<ModuleDto> {
    return this.modules.replaceQuestions(id, dto);
  }

  @Delete('modules/:moduleId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a module', description: 'Hard delete: materials and their stored files go too.' })
  remove(@Param('moduleId', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.modules.remove(id);
  }
}
