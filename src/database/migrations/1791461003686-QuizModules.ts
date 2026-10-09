import { MigrationInterface, QueryRunner } from "typeorm";

export class QuizModules1791461003686 implements MigrationInterface {
    name = 'QuizModules1791461003686'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "quiz_questions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "module_id" uuid NOT NULL, "prompt" character varying(1000) NOT NULL, "options" text array NOT NULL, "correct_index" smallint NOT NULL, "position" integer NOT NULL, CONSTRAINT "chk_quiz_questions_correct_index" CHECK (((correct_index >= 0) AND (correct_index <= 3))), CONSTRAINT "chk_quiz_questions_options" CHECK ((cardinality(options) = 4)), CONSTRAINT "PK_ec0447fd30d9f5c182e7653bfd3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_quiz_questions_module_position" ON "quiz_questions" ("module_id", "position") `);
        await queryRunner.query(`CREATE TYPE "public"."course_module_type_enum" AS ENUM('lesson', 'quiz')`);
        await queryRunner.query(`ALTER TABLE "course_modules" ADD "type" "public"."course_module_type_enum" NOT NULL DEFAULT 'lesson'`);
        await queryRunner.query(`ALTER TABLE "quiz_questions" ADD CONSTRAINT "FK_98086a36045d151124f6ad8978b" FOREIGN KEY ("module_id") REFERENCES "course_modules"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "quiz_questions" DROP CONSTRAINT "FK_98086a36045d151124f6ad8978b"`);
        await queryRunner.query(`ALTER TABLE "course_modules" DROP COLUMN "type"`);
        await queryRunner.query(`DROP TYPE "public"."course_module_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_quiz_questions_module_position"`);
        await queryRunner.query(`DROP TABLE "quiz_questions"`);
    }

}
