import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesAdminController } from './categories.admin.controller';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CoursesAdminController } from './courses.admin.controller';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { CourseCategory } from './entities/course-category.entity';
import { CourseModule } from './entities/course-module.entity';
import { Course } from './entities/course.entity';
import { ModuleMaterial } from './entities/module-material.entity';
import { QuizQuestion } from './entities/quiz-question.entity';
import { MaterialsAdminController } from './materials.admin.controller';
import { ModulesAdminController } from './modules.admin.controller';
import { ModulesService } from './modules.service';

// StorageService comes from the global StorageModule.
@Module({
  imports: [TypeOrmModule.forFeature([CourseCategory, Course, CourseModule, ModuleMaterial, QuizQuestion])],
  controllers: [
    CategoriesController,
    CategoriesAdminController,
    CoursesController,
    CoursesAdminController,
    ModulesAdminController,
    MaterialsAdminController,
  ],
  providers: [CategoriesService, CoursesService, ModulesService],
})
export class CoursesModule {}
