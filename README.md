# UniCore — NestJS + Next.js monorepo

Multi-tenant university **SIS + LMS** platform.

## Documentation

| Doc                                                                                | Purpose                                     |
| ---------------------------------------------------------------------------------- | ------------------------------------------- |
| [UNICORE_MASTER_PROMPT.md](./UNICORE_MASTER_PROMPT.md)                             | Full product specification (phases 0–19)    |
| [docs/UNICORE_100_PERCENT_COMPLETION.md](./docs/UNICORE_100_PERCENT_COMPLETION.md) | Gap analysis + implementation work packages |
| [docker/README.md](./docker/README.md)                                             | Local Docker stack                          |
| [docs/security/pen-test-checklist.md](./docs/security/pen-test-checklist.md)       | Security verification                       |

## Quick start

```bash
docker compose up -d
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- API: `http://localhost:4000` (see `apps/api`)
- Web: `http://localhost:3000` (see `apps/web`)
- Admin: `http://localhost:3002` (see `apps/admin`)

## Structure

- `apps/api` — NestJS backend
- `apps/web` — Institution portal (Next.js)
- `apps/admin` — Super-admin portal
- `packages/database` — Prisma schema & migrations

## Quality

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @unicore/api test:e2e
```
