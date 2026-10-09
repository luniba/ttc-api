import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AppConfig, DatabaseConfig } from '../config/configuration';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const db = config.getOrThrow<DatabaseConfig>('database');
        const app = config.getOrThrow<AppConfig>('app');

        return {
          type: 'postgres' as const,
          url: db.url,
          // Managed Postgres (RDS, Neon) terminates TLS with a chain the app doesn't carry, so verification is relaxed, not disabled.
          ssl: db.ssl ? { rejectUnauthorized: false } : false,
          autoLoadEntities: true,
          // Never true: schema changes must go through migrations, or an auto-sync on boot could silently drop a column in production.
          synchronize: false,
          migrationsRun: false,
          logging: app.isProduction ? ['error', 'warn'] : ['error', 'warn', 'migration'],
          retryAttempts: 5,
          retryDelay: 3000,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
