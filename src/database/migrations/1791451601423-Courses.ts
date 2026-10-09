import { MigrationInterface, QueryRunner } from "typeorm";

export class Courses1791451601423 implements MigrationInterface {
    name = 'Courses1791451601423'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "course_categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(80) NOT NULL, "slug" character varying(100) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_626794960514393da07e942f8d0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_course_categories_slug" ON "course_categories" ("slug") `);
        // Hand-written: case-insensitive name uniqueness is an expression index the differ can't generate (entity marks it synchronize:false).
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_course_categories_name_lower" ON "course_categories" (LOWER("name"))`);
        await queryRunner.query(`CREATE TABLE "courses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying(160) NOT NULL, "title" character varying(160) NOT NULL, "category_id" uuid NOT NULL, "duration" character varying(80) NOT NULL, "level" character varying(80) NOT NULL, "student_count" character varying(40) NOT NULL, "description" text NOT NULL, "price" numeric(10,2) NOT NULL, "thumbnail_key" character varying(512), "is_published" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "chk_courses_price" CHECK ((price >= (0)::numeric)), CONSTRAINT "PK_3f70a487cc718ad8eda4e6d58c9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_courses_slug" ON "courses" ("slug") `);
        await queryRunner.query(`CREATE INDEX "idx_courses_category_id" ON "courses" ("category_id") `);
        await queryRunner.query(`CREATE INDEX "idx_courses_published_created_at" ON "courses" ("is_published", "created_at") `);
        await queryRunner.query(`CREATE TABLE "course_modules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "course_id" uuid NOT NULL, "title" character varying(200) NOT NULL, "content" text NOT NULL DEFAULT '', "duration_minutes" integer NOT NULL DEFAULT '0', "is_preview" boolean NOT NULL DEFAULT false, "position" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_course_modules_duration_minutes" CHECK ((duration_minutes >= 0)), CONSTRAINT "PK_4c195db0718e8845a6e09075ebc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_course_modules_course_position" ON "course_modules" ("course_id", "position") `);
        await queryRunner.query(`CREATE TYPE "public"."module_materials_type_enum" AS ENUM('file', 'link')`);
        await queryRunner.query(`CREATE TABLE "module_materials" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "module_id" uuid NOT NULL, "type" "public"."module_materials_type_enum" NOT NULL, "title" character varying(200) NOT NULL, "file_key" character varying(512), "file_name" character varying(255), "mime_type" character varying(120), "size_bytes" integer, "url" character varying(2048), "position" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0400a2b22f3ef095599aeb00d79" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_module_materials_module_position" ON "module_materials" ("module_id", "position") `);
        await queryRunner.query(`ALTER TABLE "courses" ADD CONSTRAINT "FK_e4c260fe6bb1131707c4617f745" FOREIGN KEY ("category_id") REFERENCES "course_categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "course_modules" ADD CONSTRAINT "FK_81644557c2401f37fe9e884e884" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "module_materials" ADD CONSTRAINT "FK_f49f10a273f9aa57e62e7fd28dd" FOREIGN KEY ("module_id") REFERENCES "course_modules"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "module_materials" DROP CONSTRAINT "FK_f49f10a273f9aa57e62e7fd28dd"`);
        await queryRunner.query(`ALTER TABLE "course_modules" DROP CONSTRAINT "FK_81644557c2401f37fe9e884e884"`);
        await queryRunner.query(`ALTER TABLE "courses" DROP CONSTRAINT "FK_e4c260fe6bb1131707c4617f745"`);
        await queryRunner.query(`DROP INDEX "public"."idx_module_materials_module_position"`);
        await queryRunner.query(`DROP TABLE "module_materials"`);
        await queryRunner.query(`DROP TYPE "public"."module_materials_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_course_modules_course_position"`);
        await queryRunner.query(`DROP TABLE "course_modules"`);
        await queryRunner.query(`DROP INDEX "public"."idx_courses_published_created_at"`);
        await queryRunner.query(`DROP INDEX "public"."idx_courses_category_id"`);
        await queryRunner.query(`DROP INDEX "public"."uq_courses_slug"`);
        await queryRunner.query(`DROP TABLE "courses"`);
        await queryRunner.query(`DROP INDEX "public"."uq_course_categories_name_lower"`);
        await queryRunner.query(`DROP INDEX "public"."uq_course_categories_slug"`);
        await queryRunner.query(`DROP TABLE "course_categories"`);
    }

}
