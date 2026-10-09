import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';
import { setupSwagger } from './config/swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const logger = new Logger('Bootstrap');

  const config = app.get(ConfigService);
  const appConfig = config.getOrThrow<AppConfig>('app');

  // Module content is rich-text HTML; 100kb (the default) is too tight for a long lesson. Multipart uploads don't go through this parser.
  app.useBodyParser('json', { limit: '1mb' });

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  // So req.ip reflects the real client behind an ALB/CloudFront, not the proxy.
  app.set('trust proxy', 1);

  app.enableCors({
    // Reflects Origin instead of a literal '*', which the fetch spec forbids alongside credentials.
    origin: appConfig.corsAllowAll ? true : appConfig.corsOrigins,
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  });

  if (appConfig.corsAllowAll) {
    logger.warn(
      'CORS_ORIGINS=* — every origin may make credentialed requests. Development only; set an explicit list before deploying.',
    );
  }

  if (appConfig.apiPrefix) {
    app.setGlobalPrefix(appConfig.apiPrefix);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      // Reject unknown fields so a client can't smuggle e.g. role: "admin" into a DTO that never declared it.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableShutdownHooks();

  if (!appConfig.isProduction) {
    setupSwagger(app, appConfig.apiPrefix);
  }

  await app.listen(appConfig.port);

  logger.log(`API listening on http://localhost:${appConfig.port}${appConfig.apiPrefix}`);
  if (!appConfig.isProduction) {
    logger.log(`Docs at http://localhost:${appConfig.port}${appConfig.apiPrefix}/docs`);
  }
}

void bootstrap();
