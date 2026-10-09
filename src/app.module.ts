import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RolesGuard } from './common/guards/roles.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import configuration, {
  type AppConfig,
  type RedisConfig,
} from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { CandidatesModule } from './modules/candidates/candidates.module';
import { CoursesModule } from './modules/courses/courses.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { OrdersModule } from './modules/orders/orders.module';
import { HealthModule } from './modules/health/health.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { UsersModule } from './modules/users/users.module';
import { RedisModule } from './redis/redis.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnv,
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Blanket per-IP ceiling; auth routes (login, register, forgot-password) have their own tighter per-route caps.
        throttlers: [
          {
            ttl: config.getOrThrow<AppConfig>('app').throttleTtlMs,
            limit: config.getOrThrow<AppConfig>('app').throttleLimit,
          },
        ],
        // Redis-backed so limits are shared across instances; per-process counters would let a 5/min cap become 5N/min behind a load balancer.
        storage: new ThrottlerStorageRedisService(
          config.getOrThrow<RedisConfig>('redis').url,
        ),
      }),
    }),

    RedisModule,
    DatabaseModule,
    StorageModule,
    MailModule,

    AuthModule,
    UsersModule,
    UploadsModule,
    CoursesModule,
    CandidatesModule,
    OrdersModule,
    HealthModule,
  ],
  providers: [
    // Order matters: Throttler rejects floods first, then JwtAuthGuard populates request.user, then RolesGuard checks it.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },

    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
