import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveGoogleAuth1791516093641 implements MigrationInterface {
    name = 'RemoveGoogleAuth1791516093641'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."uq_users_google_id"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "provider"`);
        await queryRunner.query(`DROP TYPE "public"."users_provider_enum"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "google_id"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatar_url"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "avatar_url" character varying`);
        await queryRunner.query(`ALTER TABLE "users" ADD "google_id" character varying`);
        await queryRunner.query(`CREATE TYPE "public"."users_provider_enum" AS ENUM('local', 'google')`);
        await queryRunner.query(`ALTER TABLE "users" ADD "provider" "public"."users_provider_enum" NOT NULL DEFAULT 'local'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_google_id" ON "users" ("google_id") WHERE (google_id IS NOT NULL)`);
    }

}
