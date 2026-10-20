import { MigrationInterface, QueryRunner } from "typeorm";

// Candidates link to a student login, which keeps its starting password encrypted.
export class StudentLogins1791700000000 implements MigrationInterface {
    name = 'StudentLogins1791700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "temp_password_enc" character varying(512)`);
        await queryRunner.query(`ALTER TABLE "candidates" ADD "user_id" uuid`);
        await queryRunner.query(`CREATE INDEX "idx_candidates_user_id" ON "candidates" ("user_id") `);
        await queryRunner.query(`ALTER TABLE "candidates" ADD CONSTRAINT "fk_candidates_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "candidates" DROP CONSTRAINT "fk_candidates_user"`);
        await queryRunner.query(`DROP INDEX "public"."idx_candidates_user_id"`);
        await queryRunner.query(`ALTER TABLE "candidates" DROP COLUMN "user_id"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "temp_password_enc"`);
    }

}
