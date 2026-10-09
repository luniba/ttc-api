import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiForbiddenResponse, ApiNotFoundResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { UserRole, type User } from '../users/entities/user.entity';
import type { CourseDetailDto, CourseDto, ModuleDto } from './courses.mappers';
import { CoursesService } from './courses.service';
import { CheckQuizDto } from './dto/module.dto';
import { ModulesService } from './modules.service';
import type { QuizResult } from './quiz-score';

@ApiTags('courses')
@Controller('courses')
export class CoursesController {
  constructor(
    private readonly courses: CoursesService,
    private readonly modules: ModulesService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Published courses', description: 'Newest first. Not paginated.' })
  findAll(): Promise<CourseDto[]> {
    return this.courses.findAllPublic();
  }

  @Get(':slug')
  @Public()
  @ApiOperation({ summary: 'A published course with its module outline (no content)' })
  @ApiNotFoundResponse({ description: 'Unknown or unpublished course.' })
  findOne(@Param('slug') slug: string): Promise<CourseDetailDto> {
    return this.courses.findOnePublic(slug);
  }

  // Optional auth so enrolled students (later) and admins can be let through; guests only ever see preview modules.
  @Get(':slug/modules/:moduleId')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Read a module of a published course',
    description: 'Preview modules are readable by anyone, materials included (file URLs are signed, ~10 min).',
  })
  @ApiForbiddenResponse({ description: 'MODULE_LOCKED — not a preview module.' })
  @ApiNotFoundResponse({ description: 'Unknown/unpublished course, or the module is not in it.' })
  findModule(
    @Param('slug') slug: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @CurrentUser() user?: User,
  ): Promise<ModuleDto> {
    return this.modules.findOnePublic(slug, moduleId, user?.role === UserRole.ADMIN);
  }

  @Post(':slug/modules/:moduleId/quiz/check')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: 'Score a try at a quiz',
    description: 'Same access as reading the module. Returns the score and right/wrong per question, never the correct options.',
  })
  @ApiForbiddenResponse({ description: 'MODULE_LOCKED — not a preview module.' })
  checkQuiz(
    @Param('slug') slug: string,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() dto: CheckQuizDto,
    @CurrentUser() user?: User,
  ): Promise<QuizResult> {
    return this.modules.checkQuiz(slug, moduleId, dto, user?.role === UserRole.ADMIN);
  }
}
