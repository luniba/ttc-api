import { MigrationInterface, QueryRunner } from "typeorm";

export class Orders1791459420271 implements MigrationInterface {
    name = 'Orders1791459420271'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Hand-written: order numbers count up from TTC-1001 (OrdersService reads nextval). The differ can't generate sequences.
        await queryRunner.query(`CREATE SEQUENCE "orders_order_no_seq" START WITH 1001`);
        await queryRunner.query(`CREATE TABLE "order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" uuid NOT NULL, "course_id" uuid NOT NULL, "course_title" character varying(160) NOT NULL, "price" numeric(10,2) NOT NULL, CONSTRAINT "chk_order_items_price" CHECK ((price >= (0)::numeric)), CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_order_items_course_id" ON "order_items" ("course_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_order_items_order_course" ON "order_items" ("order_id", "course_id") `);
        await queryRunner.query(`CREATE TYPE "public"."order_status_enum" AS ENUM('pending', 'processing', 'completed', 'cancelled', 'failed', 'refunded')`);
        await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_no" character varying(20) NOT NULL, "candidate_id" uuid NOT NULL, "ordered_at" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."order_status_enum" NOT NULL, "total" numeric(10,2) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "chk_orders_total" CHECK ((total >= (0)::numeric)), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_orders_order_no" ON "orders" ("order_no") `);
        await queryRunner.query(`CREATE INDEX "idx_orders_candidate_id" ON "orders" ("candidate_id") `);
        await queryRunner.query(`CREATE INDEX "idx_orders_ordered_at" ON "orders" ("ordered_at") `);
        await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "FK_145532db85752b29c57d2b7b1f1" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "FK_72050220d9ee042049b15d35e31" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_6d5190e678840f627ccbd8bf506" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_6d5190e678840f627ccbd8bf506"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_72050220d9ee042049b15d35e31"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_145532db85752b29c57d2b7b1f1"`);
        await queryRunner.query(`DROP INDEX "public"."idx_orders_ordered_at"`);
        await queryRunner.query(`DROP INDEX "public"."idx_orders_candidate_id"`);
        await queryRunner.query(`DROP INDEX "public"."uq_orders_order_no"`);
        await queryRunner.query(`DROP TABLE "orders"`);
        await queryRunner.query(`DROP TYPE "public"."order_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."uq_order_items_order_course"`);
        await queryRunner.query(`DROP INDEX "public"."idx_order_items_course_id"`);
        await queryRunner.query(`DROP TABLE "order_items"`);
        await queryRunner.query(`DROP SEQUENCE "orders_order_no_seq"`);
    }

}
