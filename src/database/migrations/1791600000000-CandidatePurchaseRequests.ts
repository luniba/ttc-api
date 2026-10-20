import { MigrationInterface, QueryRunner } from "typeorm";

// Website requests start without a certificate.
export class CandidatePurchaseRequests1791600000000 implements MigrationInterface {
    name = 'CandidatePurchaseRequests1791600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "candidates" ALTER COLUMN "certificate_no" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "candidates" ALTER COLUMN "issue_date" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "candidates" ALTER COLUMN "issue_date" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "candidates" ALTER COLUMN "certificate_no" SET NOT NULL`);
    }

}
