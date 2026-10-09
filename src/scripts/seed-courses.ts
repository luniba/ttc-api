import { config as loadEnv } from 'dotenv';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import type { ConfigService } from '@nestjs/config';
import { detectImageFormat } from '../common/utils/image-signature';
import { slugify } from '../common/utils/slug';
import configuration from '../config/configuration';
import { CourseCategory } from '../modules/courses/entities/course-category.entity';
import { CourseModule } from '../modules/courses/entities/course-module.entity';
import { Course } from '../modules/courses/entities/course.entity';
import { ModuleMaterial } from '../modules/courses/entities/module-material.entity';
import { S3StorageService } from '../storage/s3-storage.service';

// The six launch courses from the old WordPress site (mirrors frontend-lms/content/courses.ts). Idempotent: categories are
// matched by name, and a course whose slug already exists (soft-deleted included) is skipped. Run with: npm run seed:courses
loadEnv();

const IMAGES_DIR = resolve(__dirname, '../../../frontend-lms/public/images');

const TESOL_TEFL = 'TESOL & TEFL';
const SPORTS = 'Sports coach certification';

const modules = (n: number) => Array.from({ length: n }, (_, i) => `Module ${i + 1}`);

const teflOverview = [
  'The TEFL course is designed to be easy to follow and to prepare you to teach an "English as a Foreign Language" (EFL) class as quickly as possible.',
  'After completing this course, you will have a strong understanding of what is required to provide quality instruction as a TEFL teacher.',
];

const tesolOverview = (hours: number) => [
  `Get your TESOL certificate. The course provides advanced teacher training and, once you pass the final examination, a globally recognised international ${hours}-hour TESOL certification.`,
  'Your TESOL certificate is your first step towards a TESOL career and a world of adventure, travel and experience.',
];

interface SeedCourse {
  slug: string;
  title: string;
  category: string;
  duration: string;
  studentCount: string;
  image: string;
  overview: string[];
  lessons: string[];
}

const COURSES: SeedCourse[] = [
  {
    slug: 'advanced-120-hour-tefl-course',
    title: 'Advanced 120-Hour TEFL Course',
    category: TESOL_TEFL,
    duration: 'Lifetime access',
    studentCount: '5,366',
    image: 'course-tefl-120.png',
    overview: teflOverview,
    lessons: [...modules(13), 'Extra Resources'],
  },
  {
    slug: 'advanced-120-hour-tesol-course',
    title: 'Advanced 120-Hour TESOL Course',
    category: TESOL_TEFL,
    duration: 'Lifetime access',
    studentCount: '6,896',
    image: 'course-tesol-120.png',
    overview: tesolOverview(120),
    lessons: [...modules(13), 'Extra Resources'],
  },
  {
    slug: 'advanced-180-hour-tefl-course',
    title: 'Advanced 180-Hour TEFL Course',
    category: TESOL_TEFL,
    duration: 'Lifetime access',
    studentCount: '5,009',
    image: 'course-tefl-180.png',
    overview: teflOverview,
    lessons: ['Full Course', ...modules(8), 'Extra Resources'],
  },
  {
    slug: 'advanced-180-hour-tesol-course',
    title: 'Advanced 180-Hour TESOL Course',
    category: TESOL_TEFL,
    duration: 'Lifetime access',
    studentCount: '6,704',
    image: 'course-tesol-180.jpeg',
    overview: tesolOverview(180),
    lessons: [...modules(13), 'Extra Resources'],
  },
  {
    slug: 'a-level-advanced-basketball-course',
    title: 'A-Level Advanced Basketball Course',
    category: SPORTS,
    duration: '5 weeks',
    studentCount: '4,515',
    image: 'course-basketball.png',
    overview: [
      "Get your A-Level Advanced Basketball Certification! This course provides in-depth training, covering advanced techniques, game strategies, and skill development. Upon completion of the final assessment, you'll earn a globally recognised certification.",
      'Take your basketball journey to the next level and unlock opportunities for coaching, competition, and personal growth!',
    ],
    lessons: [
      'Module 1: Introduction to Basketball',
      'Module 2: Fundamentals of Basketball',
      'Module 3: Offensive Skills',
      'Module 4: Defensive Skills',
      'Module 5: Team Play and Strategies',
      'Module 6: Basketball Fitness and Conditioning',
      'Module 7: Game Situations and Advanced Tactics',
      'Module 8: Practicing and Improving',
    ],
  },
  {
    slug: 'a-level-advanced-football-course',
    title: 'A-Level Advanced Football Course',
    category: SPORTS,
    duration: '5 weeks',
    studentCount: '1,219',
    image: 'course-football.png',
    overview: [
      "Get your A-Level Advanced Football Certification! This course provides in-depth training, covering advanced techniques, game strategies, and skill development. Upon completing the final assessment, you'll earn a globally recognised certification.",
      'Take your football journey to the next level and unlock opportunities for coaching, competition, and personal growth!',
    ],
    lessons: [
      'Module 1: Introduction to Football',
      'Module 2: Fundamental Skills',
      'Module 3: Tactical Understanding',
      'Module 4: Physical Conditioning',
      'Module 5: Psychological Aspects',
      'Module 6: Practical Application',
    ],
  },
];

async function seedCourses(): Promise<void> {
  const config = configuration();
  // Reuses the app's storage driver outside DI; it only needs the `storage` namespace.
  const storage = new S3StorageService({
    getOrThrow: () => config.storage,
  } as unknown as ConfigService);
  await storage.onModuleInit();

  const dataSource = new DataSource({
    type: 'postgres',
    url: config.database.url,
    ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
    entities: [CourseCategory, Course, CourseModule, ModuleMaterial],
    synchronize: false,
  });
  await dataSource.initialize();

  try {
    const categories = dataSource.getRepository(CourseCategory);
    const categoryIds = new Map<string, string>();
    for (const name of [TESOL_TEFL, SPORTS]) {
      const existing = await categories
        .createQueryBuilder('category')
        .where('LOWER(category.name) = LOWER(:name)', { name })
        .getOne();
      const category = existing ?? (await categories.save(categories.create({ name, slug: slugify(name) })));
      categoryIds.set(name, category.id);
      console.log(existing ? `Category "${name}" exists.` : `Created category "${name}".`);
    }

    for (const seed of COURSES) {
      const exists = await dataSource
        .getRepository(Course)
        .exists({ where: { slug: seed.slug }, withDeleted: true });
      if (exists) {
        console.log(`Course "${seed.slug}" exists — skipped.`);
        continue;
      }

      const buffer = await readFile(resolve(IMAGES_DIR, seed.image));
      const mimeType = detectImageFormat(buffer);
      if (!mimeType) throw new Error(`${seed.image} is not a recognisable image`);
      const thumbnail = await storage.upload({ buffer, filename: seed.image, mimeType, folder: 'courses' });

      // Course + modules together, so a failure can't leave a course with half its outline.
      await dataSource.transaction(async (manager) => {
        const course = await manager.save(
          manager.create(Course, {
            slug: seed.slug,
            title: seed.title,
            categoryId: categoryIds.get(seed.category)!,
            duration: seed.duration,
            level: 'All levels',
            studentCount: seed.studentCount,
            description: seed.overview.join('\n\n'),
            price: 99,
            thumbnailKey: thumbnail.key,
            isPublished: true,
          }),
        );
        await manager.save(
          seed.lessons.map((title, position) =>
            manager.create(CourseModule, {
              courseId: course.id,
              title,
              content: '',
              durationMinutes: 0,
              // First module is a free preview so the public preview flow has something to show.
              isPreview: position === 0,
              position,
            }),
          ),
        );
      });
      console.log(`Created course "${seed.slug}" with ${seed.lessons.length} modules.`);
    }
  } finally {
    await dataSource.destroy();
  }
}

seedCourses().catch((error: unknown) => {
  console.error('Course seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
