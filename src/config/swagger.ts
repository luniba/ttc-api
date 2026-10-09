import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Mounts interactive API docs at /docs; only called outside production since the schema maps the attack surface.
export function setupSwagger(app: INestApplication, prefix: string): void {
  const config = new DocumentBuilder()
    .setTitle('LMS API')
    .setDescription(
      'TESOL/TEFL Council LMS API. Auth uses a short-lived bearer access token plus a ' +
        'rotating refresh token held in an httpOnly cookie.',
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token returned by /auth/login.',
      },
      'access-token',
    )
    .addTag(
      'auth',
      'Registration, login, Google OAuth, email verification, password reset',
    )
    .addTag('health', 'Liveness and readiness probes')
    .addTag('uploads', 'Image upload — returns a storage key')
    .addTag('admin: users', 'Staff (admins and instructors) administration')
    .addTag('admin: students', 'Student accounts, read-only')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(`${prefix}/docs`, app, document, {
    jsonDocumentUrl: `${prefix}/docs-json`,
    swaggerOptions: {
      persistAuthorization: true,
      // Cookie-based refresh calls need credentials to be sent from the UI.
      withCredentials: true,
    },
  });
}
