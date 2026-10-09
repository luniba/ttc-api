import { Global, Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { RedisConfig } from '../config/configuration';

export const REDIS_CLIENT = 'REDIS_CLIENT';

// Global since it backs cross-cutting concerns (rate limiting, later caching/queues) rather than one feature.
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const redis = config.getOrThrow<RedisConfig>('redis');
        const logger = new Logger('Redis');

        const client = new Redis(redis.url, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => Math.min(times * 200, 5000),
        });

        client.on('error', (error: Error) => logger.error(`Redis error: ${error.message}`));
        client.on('connect', () => logger.log('Redis connected'));

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisModule.name);

  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  /** ioredis keeps a socket open, which would stop the process exiting on SIGTERM. */
  async onApplicationShutdown(): Promise<void> {
    try {
      await this.client.quit();
      this.logger.log('Redis connection closed');
    } catch {
      this.client.disconnect();
    }
  }
}
