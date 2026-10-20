import { config as loadEnv } from 'dotenv';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import configuration from '../config/configuration';
import { Candidate } from '../modules/candidates/entities/candidate.entity';
import { User } from '../modules/users/entities/user.entity';
import { CourseCategory } from '../modules/courses/entities/course-category.entity';
import { CourseModule } from '../modules/courses/entities/course-module.entity';
import { Course } from '../modules/courses/entities/course.entity';
import { ModuleMaterial } from '../modules/courses/entities/module-material.entity';
import { QuizQuestion } from '../modules/courses/entities/quiz-question.entity';

// Imports the old site's certificate register as candidates (data/wp-certificates.json). Idempotent. Dry run: DRY_RUN=true.
loadEnv();

interface WpCertificate {
  certificate_no: string;
  passport_name: string;
  passport_number: string;
  date_of_birth: string;
  address: string;
  email: string | null;
  course: string;
  issue_date: string;
  nationality: string;
}

// Old course name -> seeded course slug.
const COURSE_SLUGS: Record<string, string> = {
  TEFL: 'advanced-120-hour-tefl-course',
  TESOL: 'advanced-120-hour-tesol-course',
};

async function importCertificates(): Promise<void> {
  const dryRun = process.env.DRY_RUN === 'true';
  const rows = JSON.parse(
    await readFile(resolve(__dirname, '../../data/wp-certificates.json'), 'utf8'),
  ) as WpCertificate[];

  const config = configuration();
  const dataSource = new DataSource({
    type: 'postgres',
    url: config.database.url,
    ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
    entities: [Candidate, Course, CourseCategory, CourseModule, ModuleMaterial, QuizQuestion, User],
    synchronize: false,
  });
  await dataSource.initialize();

  try {
    const courseIds = new Map<string, string>();
    for (const [label, slug] of Object.entries(COURSE_SLUGS)) {
      const course = await dataSource.getRepository(Course).findOne({ where: { slug }, withDeleted: true });
      if (!course) throw new Error(`Course "${slug}" not found. Run npm run seed:courses first.`);
      courseIds.set(label, course.id);
    }

    const repo = dataSource.getRepository(Candidate);
    let created = 0;
    let skipped = 0;

    for (const row of rows) {
      const certificateNo = row.certificate_no.trim();
      const courseId = courseIds.get(row.course.trim().toUpperCase());
      if (!courseId) throw new Error(`${certificateNo}: unknown course "${row.course}"`);

      if (await repo.exists({ where: { certificateNo }, withDeleted: true })) {
        skipped++;
        continue;
      }
      if (dryRun) {
        created++;
        continue;
      }

      // The printed certificate number doubles as the public ID.
      await repo.insert({
        certificateId: certificateNo,
        certificateNo,
        passportName: row.passport_name.trim(),
        passportNo: row.passport_number.trim(),
        dateOfBirth: row.date_of_birth,
        address: row.address.trim(),
        // Column is NOT NULL; one legacy record has no email.
        email: (row.email ?? '').trim().toLowerCase(),
        courseId,
        issueDate: row.issue_date,
        nationality: row.nationality.trim(),
        // Already issued, so the public check accepts them.
        isVerified: true,
        verifiedAt: new Date(`${row.issue_date}T00:00:00Z`),
      });
      created++;
    }

    console.log(`${dryRun ? '[dry run] would create' : 'Created'} ${created}, skipped ${skipped} existing, of ${rows.length}.`);
  } finally {
    await dataSource.destroy();
  }
}

importCertificates().catch((err) => {
  console.error(err);
  process.exit(1);
});
