# ttc-api server setup (one-time)

Assumes the shared box already has Docker, the `web` network and Caddy
(see `DEPLOY.md` section 4). 

## 1. Folder

```bash
mkdir -p /var/www/ttc/ttc-api && cd /var/www/ttc/ttc-api
```

## 2. Secrets

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # JWT_ACCESS_SECRET
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"   # POSTGRES / REDIS / MINIO passwords
```

## 3. `.env` (written by hand, never touched by CI)

```bash
NODE_ENV=production
PORT=5010
API_PREFIX=api
CORS_ORIGINS=https://v2.tesolteflcouncil.com
FRONTEND_URL=https://v2.tesolteflcouncil.com

# compose vars (also used by postgres/redis/minio services)
POSTGRES_USER=ttc
POSTGRES_PASSWORD=<pw>
POSTGRES_DB=ttc
REDIS_PASSWORD=<pw>
MINIO_ROOT_USER=<user>
MINIO_ROOT_PASSWORD=<pw>

# service names, not localhost
DATABASE_URL=postgresql://ttc:<pw>@postgres:5432/ttc
DATABASE_SSL=false
REDIS_URL=redis://:<pw>@redis:6379

JWT_ACCESS_SECRET=<48-byte hex>
REQUIRE_EMAIL_VERIFIED=true

# Client proxies /api/* same-origin, so host-only cookies work.
# (api-v2.tesolteflcouncil.com is also public for direct/Swagger access.)
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
COOKIE_DOMAIN=

STORAGE_DRIVER=minio
STORAGE_BUCKET=ttc
STORAGE_PRIVATE_BUCKET=ttc-private
MINIO_ENDPOINT=http://minio:9000
MINIO_ACCESS_KEY=<same as MINIO_ROOT_USER>
MINIO_SECRET_KEY=<same as MINIO_ROOT_PASSWORD>
MINIO_PUBLIC_URL=https://v2-media.tesolteflcouncil.com

SMTP_HOST=<smtp host>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<user>
SMTP_PASS=<pw>
MAIL_FROM=TESOL TEFL Council <no-reply@tesolteflcouncil.com>

ADMIN_EMAIL=<admin email>
ADMIN_PASSWORD=<strong pw>
ADMIN_NAME=Super Admin

THROTTLE_TTL_MS=60000
THROTTLE_LIMIT=100
```

`chmod 600 .env`.

## 4. DNS + Caddy

Point `api-v2` and `v2-media` (under tesolteflcouncil.com) A records at the box first, then append
`deploy/Caddyfile.snippet` to `~/infra/Caddyfile` and reload:

```bash
cd ~/infra && docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile
```

## 5. First boot (after first CI push published the image)

The first CI deploy will copy compose and try to start. Migrations run in CI.
Then once:

```bash
cd /var/www/ttc/ttc-api
docker compose exec minio mc alias set local http://localhost:9000 <MINIO_ROOT_USER> <MINIO_ROOT_PASSWORD>
docker compose exec minio mc mb --ignore-existing local/ttc
docker compose exec minio mc anonymous set download local/ttc
# ttc-private is created by the API on boot and must stay private.

docker compose run --rm api npm run seed:admin
# optional: docker compose run --rm api npm run seed:courses
```

## 6. Verify

```bash
docker compose ps
docker compose exec api node -e "require('http').get('http://localhost:5010/api/health/live',r=>console.log(r.statusCode))"
```

Cross-app: client `NEXT_PUBLIC_SITE_URL` must be in `CORS_ORIGINS`, and
`FRONTEND_URL` must equal it.
