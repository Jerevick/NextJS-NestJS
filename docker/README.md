# Local development stack (WP-0.1)

## Start services

```bash
docker compose up -d
```

Wait until all services are healthy:

```bash
docker compose ps
```

| Service    | URL / port                                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL | `127.0.0.1:15432` — user `unicore`, password `unicore`, DB `unicore` (host port **15432** avoids conflict with a local Postgres on 5432) |
| Redis      | `localhost:6379`                                                                                                                         |
| MinIO      | S3 API `9000`, console http://localhost:9001 (`minio` / `minio12345`)                                                                    |
| Mailhog    | SMTP `1025`, UI http://localhost:8025                                                                                                    |
| Bull Board | http://localhost:3001 (all API queues pre-registered via `queue-registry`)                                                               |

Postgres uses **pgvector/pgvector:pg16** (Postgres 16 + `vector`; plain `postgres:16-alpine` cannot load pgvector). Init (`docker/postgres/init.sql`) enables: `vector`, `pg_trgm`, `uuid-ossp`, `pgcrypto`.

Verify extensions:

```bash
docker compose exec postgres psql -U unicore -d unicore -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

## Database migrate & seed

1. Copy env:

   ```bash
   cp packages/database/.env.example packages/database/.env
   ```

2. Set **local** Postgres in `packages/database/.env` (migrate dev cannot use Prisma Accelerate alone):

   ```env
   DATABASE_URL="postgresql://unicore:unicore@127.0.0.1:15432/unicore?schema=public"
   DIRECT_DATABASE_URL="postgresql://unicore:unicore@127.0.0.1:15432/unicore?schema=public"
   ```

   If you use Accelerate at runtime, keep `DATABASE_URL=prisma://...` but **must** set `DIRECT_DATABASE_URL` to the real Postgres host for `pnpm db:migrate`.

3. From repo root:

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

| Script          | Command                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Migrate / seed  | `pnpm db:migrate`, `pnpm db:seed`                                                              |
| Studio          | `pnpm db:studio`                                                                               |
| Tests           | `pnpm test` (turbo → `@unicore/api` Jest); `pnpm test:workspace` when more packages add `test` |
| Clean artifacts | `pnpm clean` (turbo → all packages with `clean` script)                                        |

Use Prisma **6.19.3** from the repo root (`pnpm install`); do not use a global Prisma 7 CLI.

## BullMQ queues (apps/api)

When the API runs with `REDIS_URL=redis://localhost:6379`, Bull Board lists queues such as:

- `billing-daily-snapshot`, `billing-monthly`, `billing-lock-invoice`, `billing-retroactive`
- `notification-dispatch`, `notification-bulk`, `notification-scheduled`
- `entity-provisioning`, `bulk-enrollment`, `student-csv-import`
- `finance-bulk-charge`, `finance-payment-reminder`
- `ai-embed-content`, `lms-transcode`, `sports-eligibility`, `webhook-delivery`

## App env (after Docker is up)

```env
DATABASE_URL=postgresql://unicore:unicore@127.0.0.1:15432/unicore?schema=public
REDIS_URL=redis://localhost:6379
AWS_S3_ENDPOINT=http://localhost:9000
AWS_S3_BUCKET=unicore
AWS_REGION=us-east-1
# MinIO credentials
AWS_ACCESS_KEY_ID=minio
AWS_SECRET_ACCESS_KEY=minio12345
```
