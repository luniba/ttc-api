# LMS Backend

API for the TESOL/TEFL Council LMS (public site + admin panel, both Next.js).

NestJS 11 + TypeORM + Postgres + Redis + S3-compatible storage.

## Quick start

```bash
cp .env.example .env      # defaults work as-is for local dev
npm install
npm run infra:up          # postgres + redis + minio + mailpit
npm run migration:run     # create the schema
npm run seed:admin        # optional: create the admin from ADMIN_* vars
npm run seed:courses      # optional: the 6 launch courses + categories
npm run start:dev
```

| Service       | URL                        | Credentials                    |
| ------------- | -------------------------- | ------------------------------ |
| API           | http://localhost:5010/api      | —                          |
| API docs      | http://localhost:5010/api/docs | —                          |
| Mail inbox    | http://localhost:8027      | —                              |
| MinIO console | http://localhost:9005      | minioadmin / minioadmin        |
| MinIO S3 API  | http://localhost:9004      | minioadmin / minioadmin        |
| Postgres      | localhost:5434             | lms / lms_password             |
| Redis         | localhost:6381             | —                              |

Host ports are offset from the defaults (and from soho-api's 5433/6380/9002)
so this stack coexists with other projects. The Next.js frontend runs on 3000
and proxies `/api/*` here same-origin — see `CORS_ORIGINS`.

Every route is under `API_PREFIX=api` (`/api/auth/login`, `/api/health`, ...),
so the refresh cookie is scoped to `/api/auth`. The tables below omit the prefix.

Seeded admin (`npm run seed:admin`, from `ADMIN_*`): `admin@ttc.com` / `Password@123`.

## Layout

```
src/
  config/      configuration.ts (typed env), env.validation.ts (fail-fast), swagger.ts
  common/      filters, interceptors, guards, decorators — no business logic
  database/    TypeORM wiring, data-source.ts (CLI), migrations/
  redis/       shared ioredis connection
  storage/     StorageService abstraction + S3 driver (MinIO and AWS S3)
  mail/        nodemailer + templates
  modules/     feature modules: auth, users, uploads, courses, candidates, orders, health
  scripts/     one-off CLI scripts (seed-admin, seed-courses)
```

Feature code lives in `modules/<feature>/` with `*.controller.ts`, `*.service.ts`,
`dto/`, `entities/`. Cross-cutting infrastructure (`storage/`, `mail/`, `redis/`,
`database/`) sits at the top level because it is global, not a feature.

Config is read from `process.env` in exactly one place — `config/configuration.ts`.
Everything else uses `config.getOrThrow<XConfig>('namespace')`.

## Auth

Access token (JWT, 15m) in the `Authorization: Bearer` header; refresh token
(opaque, 7d, rotating) in an httpOnly cookie. Only the SHA-256 hash of the
refresh token is stored.

Routes are **protected by default** via a global `JwtAuthGuard`; public routes opt
out with `@Public()`. Roles are enforced with `@Roles(UserRole.ADMIN)`.

Roles: `admin`, `instructor`, `student`. `STAFF_ROLES` (admin + instructor) may
reach the admin panel; user management writes are admin-only. Admin routes live
under `/admin/*` in `*.admin.controller.ts` gated by `@Roles(...STAFF_ROLES)`;
public routes in `*.controller.ts` marked `@Public()`.

| Endpoint                          | Notes                                          |
| --------------------------------- | ---------------------------------------------- |
| `GET    /admin/users`             | Staff list (admins + instructors). Staff only. |
| `POST   /admin/users`             | Create an instructor. Admin only.              |
| `PATCH  /admin/users/:id`         | Edit an instructor. Admin only.                |
| `PATCH  /admin/users/:id/password`| Set an instructor's password. Admin only.      |
| `DELETE /admin/users/:id`         | Soft-delete staff. Admin only.                 |
| `GET    /admin/students`          | Paginated student list. Staff only.            |
| `POST   /uploads`                 | Image upload → storage key. Staff only.        |
| `GET    /health`, `/health/live`  | Readiness / liveness. Public.                  |

### Courses

Full contract (shapes, error codes): `../docs/courses-api.md`. Admin routes are
**admin only** (`@Roles(UserRole.ADMIN)`), not staff.

| Endpoint                                         | Notes                                                       |
| ------------------------------------------------ | ----------------------------------------------------------- |
| `GET/POST /admin/course-categories`              | 409 `CATEGORY_TAKEN` (name, case-insensitive).              |
| `GET/POST /admin/courses`                        | Paginated, `q`, `status`. 409 `SLUG_TAKEN`.                 |
| `GET/PATCH/DELETE /admin/courses/:id`            | DELETE is a soft delete; modules are kept.                  |
| `GET/POST /admin/courses/:id/modules`            | POST appends last.                                          |
| `PATCH /admin/courses/:id/modules/order`         | `{ moduleIds }` = exactly the course's modules, else 400.   |
| `GET/PATCH/DELETE /admin/modules/:moduleId`      | Content HTML sanitised. DELETE removes materials + files.   |
| `POST /admin/modules/:moduleId/materials/file`   | pdf/doc/docx/ppt/pptx by magic bytes (415), ≤ 50 MB (413).  |
| `POST /admin/modules/:moduleId/materials/link`   | https URLs only.                                            |
| `DELETE /admin/materials/:id`                    | Deletes the stored file too.                                |
| `PUT /admin/modules/:moduleId/questions`         | Quiz only: replaces the whole list. 4 distinct options, `correctIndex` 0–3. |
| `GET /course-categories`, `GET /courses`         | Public. Published courses only.                             |
| `GET /courses/:slug`                             | Public. Course + module outline (no content). 404 if draft. |
| `GET /courses/:slug/modules/:moduleId`           | Public for `isPreview` modules, else 403 `MODULE_LOCKED`.   |
| `POST /courses/:slug/modules/:moduleId/quiz/check` | Same access. `{ answers }` → score + right/wrong per question; never the correct options. 30/min. |

Material files live in a **private bucket** (`STORAGE_PRIVATE_BUCKET`, default
`lms-private`, created on boot for MinIO with no public policy). They are never
exposed by URL; responses carry ~10 min signed GET URLs that download with the
original file name. On AWS, create that bucket with Block Public Access on.

### Candidates

Certificate holders (not login accounts). **Admin only.** Every field is required;
`certificateId` (`kuqwc-tesoltefl-35620`) is generated on create and can't be set or edited.
Dates are calendar days (`YYYY-MM-DD`). Deletes are soft.

| Endpoint                             | Notes                                                          |
| ------------------------------------ | -------------------------------------------------------------- |
| `GET/POST /admin/candidates`         | Paginated, `q` (IDs, names, passport No, email). 409 `CERTIFICATE_NO_TAKEN`. |
| `GET/PATCH/DELETE /admin/candidates/:id` | Unknown course → 400. `dateOfBirth` must be in the past.   |
| `POST /admin/candidates/:id/verify`  | Sets `isVerified` + `verifiedAt`; idempotent. `?verified=true\|false` filters the list. |
| `POST /certificates/verify`         | Public, 10/min. Name (case/spacing ignored) + passport No + certificate ID must match a **verified** candidate; one generic 404 otherwise. |

### Orders

Created by an admin for a candidate. **Admin only.** `orderNo` (`TTC-1001`, `TTC-1002`…) comes from
the `orders_order_no_seq` sequence. An order holds one or more courses; each item copies the
course's title and price when added, and `total` is their sum. Status: pending, processing,
completed, cancelled, failed, refunded. Deletes are soft.

| Endpoint                          | Notes                                                              |
| --------------------------------- | ------------------------------------------------------------------ |
| `GET/POST /admin/orders`          | Paginated, `q` (order No, candidate name/email/certificate ID), `status`. |
| `GET/PATCH/DELETE /admin/orders/:id` | Kept courses keep their price; added ones take the current price. |

### Auth endpoints

| Endpoint                         | Notes                                      |
| -------------------------------- | ------------------------------------------ |
| `POST /auth/register`            | Sends verification email. No session yet.  |
| `POST /auth/verify-email`        | Confirms address, establishes session.     |
| `POST /auth/resend-verification` | Generic response (no enumeration).         |
| `POST /auth/login`               | 403 `EMAIL_NOT_VERIFIED` until confirmed.  |
| `POST /auth/refresh`             | Rotates the token. Needs CSRF header.      |
| `POST /auth/logout`              | Needs CSRF header.                         |
| `POST /auth/logout-all`          | Revokes every session.                     |
| `POST /auth/forgot-password`     | Generic response.                          |
| `POST /auth/reset-password`      | Revokes all sessions.                      |
| `POST /auth/change-password`     | Revokes all sessions.                      |
| `GET  /auth/me`                  | Current user.                              |
| `PATCH /auth/me`                 | Update own name.                           |

### CSRF

`/auth/refresh` and `/auth/logout` authenticate on the cookie alone, so they use
double-submit CSRF: read the `lms_csrf` cookie (or the `csrfToken` field
returned at login) and echo it in the `X-CSRF-Token` header.

Bearer-authenticated routes need no CSRF token — an attacker's page cannot set
that header.

### Frontend contract

1. `POST /auth/login` → keep `accessToken` **in memory** (not localStorage — that
   is XSS-readable), send it as `Authorization: Bearer`.
2. On 401, `POST /auth/refresh` with `credentials: 'include'` + `X-CSRF-Token`,
   then retry.

Errors carry a stable `code` (`EMAIL_NOT_VERIFIED`, `INVALID_CREDENTIALS`,
`INVALID_SESSION`, `CSRF_FAILED`) — branch on that, not on the
human-readable message.

## Migrations

`synchronize` is **off everywhere**. Schema changes are always migrations:

```bash
npm run migration:generate -- src/database/migrations/DescribeChange
npm run migration:run
npm run migration:revert
npm run migration:show
```

## Moving to AWS

Every local service has a managed counterpart, reachable by env change only:

| Local    | AWS          | Change                                    |
| -------- | ------------ | ----------------------------------------- |
| postgres | RDS / Aurora | `DATABASE_URL`, `DATABASE_SSL=true`       |
| minio    | S3           | `STORAGE_DRIVER=s3`, `AWS_REGION`, bucket |
| redis    | ElastiCache  | `REDIS_URL` (`rediss://` for TLS)         |
| mailpit  | SES          | `SMTP_*` credentials                      |

MinIO and S3 share the S3 API and one client (`S3StorageService`), so no code
changes. On AWS, leave `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` empty so the
SDK picks up the task/instance IAM role instead of long-lived keys.

Also set for production: `COOKIE_SECURE=true`, `NODE_ENV=production`,
`CORS_ORIGINS` to exact origins, and a fresh `JWT_ACCESS_SECRET`. Run `npm run migration:run` as a release step, not on boot.

Storage persists the object **key**, never the URL — so introducing CloudFront
later needs no data migration.

## Scripts

| Script                     | Purpose                            |
| -------------------------- | ---------------------------------- |
| `npm run start:dev`        | Watch mode                         |
| `npm run build`            | Compile to `dist/`                 |
| `npm run typecheck`        | `tsc --noEmit`                     |
| `npm run lint`             | ESLint with `--fix`                |
| `npm run infra:up/down`    | Docker services                    |
| `npm run infra:reset`      | Wipe volumes and restart           |
| `npm run seed:admin`       | Create the admin (idempotent)      |
| `npm run seed:courses`     | Seed launch courses (idempotent)   |
