import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

// Used by the TypeORM CLI only, which runs outside the Nest DI container and can't reach ConfigService. Keep in sync with database.module.ts.
loadEnv();

const useSsl = process.env.DATABASE_SSL === 'true';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  // Migrations are the only thing allowed to change the schema.
  synchronize: false,
  logging: ['error', 'warn', 'migration'],
});
