import { MigrationInterface, QueryRunner } from "typeorm";

export class Candidates1791456867086 implements MigrationInterface {
    name = 'Candidates1791456867086'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "candidates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "certificate_id" character varying(40) NOT NULL, "certificate_no" character varying(60) NOT NULL, "passport_name" character varying(160) NOT NULL, "passport_no" character varying(40) NOT NULL, "date_of_birth" date NOT NULL, "address" character varying(500) NOT NULL, "email" character varying(254) NOT NULL, "course_id" uuid NOT NULL, "issue_date" date NOT NULL, "nationality" character varying(80) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_140681296bf033ab1eb95288abb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_candidates_certificate_id" ON "candidates" ("certificate_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_candidates_certificate_no" ON "candidates" ("certificate_no") `);
        await queryRunner.query(`CREATE INDEX "idx_candidates_course_id" ON "candidates" ("course_id") `);
        await queryRunner.query(`CREATE INDEX "idx_candidates_created_at" ON "candidates" ("created_at") `);
        await queryRunner.query(`ALTER TABLE "candidates" ADD CONSTRAINT "FK_1912f27ab5b023a46c481d43c4b" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "candidates" DROP CONSTRAINT "FK_1912f27ab5b023a46c481d43c4b"`);
        await queryRunner.query(`DROP INDEX "public"."idx_candidates_created_at"`);
        await queryRunner.query(`DROP INDEX "public"."idx_candidates_course_id"`);
        await queryRunner.query(`DROP INDEX "public"."uq_candidates_certificate_no"`);
        await queryRunner.query(`DROP INDEX "public"."uq_candidates_certificate_id"`);
        await queryRunner.query(`DROP TABLE "candidates"`);
    }

}
