import { MigrationInterface, QueryRunner } from "typeorm";

export class CandidateVerification1791459623074 implements MigrationInterface {
    name = 'CandidateVerification1791459623074'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "candidates" ADD "is_verified" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "candidates" ADD "verified_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`CREATE INDEX "idx_candidates_is_verified" ON "candidates" ("is_verified") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_candidates_is_verified"`);
        await queryRunner.query(`ALTER TABLE "candidates" DROP COLUMN "verified_at"`);
        await queryRunner.query(`ALTER TABLE "candidates" DROP COLUMN "is_verified"`);
    }

}
