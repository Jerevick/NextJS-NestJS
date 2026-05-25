# Database migrate troubleshooting

## P3006 / `OrgUnit` does not exist (shadow database)

**Cause:** Migration `20260519120000_hr_phase10` references `OrgUnit` before it exists. The fix migration `20260519110000_org_structure` must run first (it is in the repo).

**Also common:** `DATABASE_URL` points at **Prisma Accelerate** (`accelerate.prisma-data.net` or `prisma://`). `migrate dev` needs a **direct** Postgres URL for the shadow database.

**Fix:**

1. Edit `packages/database/.env`:

   ```env
   DATABASE_URL="postgresql://unicore:unicore@localhost:5432/unicore?schema=public"
   DIRECT_DATABASE_URL="postgresql://unicore:unicore@localhost:5432/unicore?schema=public"
   ```

2. Start Docker Postgres: `docker compose up -d postgres`

3. Run: `pnpm db:migrate`

## Prisma 7 CLI error (`url` no longer supported)

Use Prisma **6.19.3** from the repo root (`pnpm install`). Do not run a global Prisma 7 CLI.

## P1010: User was denied access on the database

**On `localhost:5432` this usually means:**

0. **Port 5432 is already used by another Postgres** (common on Windows). This repo’s Docker stack uses host port **15432** — set `DIRECT_DATABASE_URL=postgresql://unicore:unicore@127.0.0.1:15432/unicore?schema=public` and run `docker compose up -d postgres`.

1. **Docker Postgres is not running** — start Docker Desktop, then:

   ```powershell
   docker compose up -d postgres
   docker compose ps
   ```

   Wait until `postgres` is `healthy`.

2. **Another Postgres is bound to port 5432** (Windows service, WSL, old install) with different credentials than `unicore` / `unicore`. Either stop that service or change `DIRECT_DATABASE_URL` to match that instance.

3. **Test the connection:**
   ```powershell
   docker compose exec postgres psql -U unicore -d unicore -c "SELECT 1"
   ```
   If that works but `pnpm db:migrate` fails, run migrate again.

**Without local Docker:** set `DIRECT_DATABASE_URL` to the **direct** `postgresql://...` string from Prisma Data Platform / Neon (not Accelerate, not `localhost` unless you run Postgres locally).

## Migration already applied on Accelerate but tables missing

Run the SQL in `packages/database/prisma/migrations/20260519110000_org_structure/migration.sql` against your direct database, then:

```bash
pnpm exec prisma migrate resolve --applied 20260519110000_org_structure --schema packages/database/prisma/schema.prisma
```
