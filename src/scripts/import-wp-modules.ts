import { config as loadEnv } from 'dotenv';
import { readFile } from 'fs/promises';
import { basename, extname, resolve } from 'path';
import { DataSource } from 'typeorm';
import type { ConfigService } from '@nestjs/config';
import { detectDocumentType } from '../common/utils/document-signature';
import configuration from '../config/configuration';
import { CourseCategory } from '../modules/courses/entities/course-category.entity';
import { CourseModule } from '../modules/courses/entities/course-module.entity';
import { Course } from '../modules/courses/entities/course.entity';
import { MaterialType, ModuleMaterial } from '../modules/courses/entities/module-material.entity';
import { QuizQuestion } from '../modules/courses/entities/quiz-question.entity';
import { S3StorageService } from '../storage/s3-storage.service';

// Copies the lesson PDFs of the two 120-hour courses from the old WordPress site into the new modules as file materials (private
// bucket, same as an admin upload). Input: data/wp-module-content.json, a module title -> links map taken from the WP dump.
// Idempotent: a module that already has materials is skipped. Run seed:courses first. Dry run: DRY_RUN=true.
// Run with: npm run import:wp-modules
loadEnv();

interface WpModule {
  courseSlug: string;
  moduleTitle: string;
  materials: { title: string; url: string }[];
}

async function download(url: string): Promise<Buffer> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      if (!buffer.byteLength) throw new Error('empty response');
      return buffer;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function importModules(): Promise<void> {
  const dryRun = process.env.DRY_RUN === 'true';
  const wanted: WpModule[] = JSON.parse(await readFile(resolve(__dirname, '../../data/wp-module-content.json'), 'utf8'));

  const config = configuration();
  const storage = new S3StorageService({ getOrThrow: () => config.storage } as unknown as ConfigService);
  await storage.onModuleInit();

  const dataSource = new DataSource({
    type: 'postgres',
    url: config.database.url,
    ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
    entities: [CourseCategory, Course, CourseModule, ModuleMaterial, QuizQuestion],
    synchronize: false,
  });
  await dataSource.initialize();

  try {
    const modules = dataSource.getRepository(CourseModule);
    const materials = dataSource.getRepository(ModuleMaterial);
    let added = 0;
    let skipped = 0;
    const failures: string[] = [];

    for (const wp of wanted) {
      const module = await modules
        .createQueryBuilder('m')
        .innerJoin('m.course', 'c')
        .where('c.slug = :slug AND m.title = :title', { slug: wp.courseSlug, title: wp.moduleTitle })
        .getOne();
      if (!module) {
        failures.push(`${wp.courseSlug} / ${wp.moduleTitle}: no matching module (run seed:courses first)`);
        continue;
      }
      if (await materials.existsBy({ moduleId: module.id })) {
        skipped++;
        continue;
      }

      const uploaded: { key: string; row: Partial<ModuleMaterial> }[] = [];
      try {
        for (const [position, link] of wp.materials.entries()) {
          const fileName = decodeURIComponent(basename(new URL(link.url).pathname));
          console.log(`${dryRun ? '[dry run] ' : ''}${wp.courseSlug} / ${wp.moduleTitle}: ${link.title} <- ${fileName}`);
          if (dryRun) continue;

          const buffer = await download(link.url);
          const type = detectDocumentType(buffer, fileName);
          if (!type) throw new Error(`${link.url}: not a valid ${extname(fileName) || 'document'} file`);
          const stored = await storage.uploadPrivate({
            buffer,
            filename: `file.${type.ext}`,
            mimeType: type.mimeType,
            folder: 'materials',
          });
          uploaded.push({
            key: stored.key,
            row: {
              moduleId: module.id,
              type: MaterialType.FILE,
              title: link.title.slice(0, 200),
              fileKey: stored.key,
              fileName: fileName.slice(0, 255),
              mimeType: type.mimeType,
              sizeBytes: stored.size,
              url: null,
              position,
            },
          });
        }
        // A module's materials go in together, so a failed download never leaves it half-filled.
        if (uploaded.length) await materials.insert(uploaded.map((u) => u.row));
        added += wp.materials.length;
      } catch (error) {
        for (const u of uploaded) await storage.deletePrivate(u.key).catch(() => undefined);
        failures.push(`${wp.courseSlug} / ${wp.moduleTitle}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log(`${dryRun ? '[dry run] would add' : 'Added'} ${added} materials, skipped ${skipped} modules that already have some.`);
    if (failures.length) {
      console.error(`${failures.length} module(s) failed:\n${failures.join('\n')}`);
      process.exitCode = 1;
    }
  } finally {
    await dataSource.destroy();
  }
}

importModules().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
