import { MigrationInterface, QueryRunner } from "typeorm";

// A changeable username, and enrolments.
export class StudentArea1791800000000 implements MigrationInterface {
    name = 'StudentArea1791800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "username" character varying(255)`);
        // Case-insensitive, and only for accounts that picked one.
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_username_lower" ON "users" (lower("username")) WHERE "username" IS NOT NULL`);

        await queryRunner.query(`CREATE TABLE "enrolments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "course_id" uuid NOT NULL, "granted_by" uuid, "granted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_enrolments_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_enrolments_user_course" ON "enrolments" ("user_id", "course_id") `);
        await queryRunner.query(`CREATE INDEX "idx_enrolments_course_id" ON "enrolments" ("course_id") `);
        await queryRunner.query(`ALTER TABLE "enrolments" ADD CONSTRAINT "fk_enrolments_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "enrolments" ADD CONSTRAINT "fk_enrolments_course" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "enrolments" DROP CONSTRAINT "fk_enrolments_course"`);
        await queryRunner.query(`ALTER TABLE "enrolments" DROP CONSTRAINT "fk_enrolments_user"`);
        await queryRunner.query(`DROP INDEX "public"."idx_enrolments_course_id"`);
        await queryRunner.query(`DROP INDEX "public"."uq_enrolments_user_course"`);
        await queryRunner.query(`DROP TABLE "enrolments"`);
        await queryRunner.query(`DROP INDEX "public"."uq_users_username_lower"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "username"`);
    }

}
