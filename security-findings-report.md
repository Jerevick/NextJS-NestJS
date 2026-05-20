# UniCore Security Findings Report — Phase 16

**Audit date:** 2026-05-18  
**Scope:** `apps/api` NestJS API (billing integrity, tenant isolation, application security)

## Executive summary

| Severity | Open | Fixed this phase |
| -------- | ---- | ---------------- |
| CRITICAL | 0    | 0                |
| HIGH     | 0    | 4                |
| MEDIUM   | 0    | 3                |
| LOW      | 0    | 3                |

Automated audit specs live under `apps/api/src/common/security/*.audit.spec.ts` (including `field-encryption.audit.spec.ts` for salary / AI key encryption).

---

## Fixed in Phase 16

### HIGH — Missing Helmet security headers

- **Finding:** API responses lacked standard security headers (CSP, HSTS, `X-Frame-Options`, etc.).
- **Fix:** `helmet` middleware in `apps/api/src/main.ts`.

### HIGH — Login brute-force not rate-limited per prompt spec

- **Finding:** Global throttler allowed 200 req/min; login was not separately capped.
- **Fix:** `@Throttle({ limit: 5, ttl: 900_000 })` on `POST /auth/login` and magic-link request (5 attempts / 15 min).

### HIGH — File upload extension spoofing

- **Finding:** Uploads trusted `mimetype` without magic-byte verification.
- **Fix:** `assertUploadMimeMatchesMagicBytes` applied to branding logo, leave documents, election uploads.

### HIGH — `enrollmentStatus` written outside `StatusChangeService`

- **Finding:** `StudentDeletionService` updated `enrollmentStatus` directly.
- **Fix:** Permanent deletion now calls `StatusChangeService.changeEnrollmentStatus` before anonymisation.

### MEDIUM — Affiliate entity switch

- **Finding:** Staff could switch JWT context to `AFFILIATE` campus entities.
- **Fix:** `assertCanSwitchToEntity` blocks unless `*` or `institutions.write`.

### MEDIUM — Institution settings read on every request

- **Finding:** Hot settings paths hit Postgres repeatedly.
- **Fix:** `TenantCacheService` with 5-minute TTL + invalidation on settings patch.

---

## Accepted / documented exceptions

| Item                                                                | Rationale                                                                               |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `StudentsRepository.create` sets initial `enrollmentStatus: ACTIVE` | New student admission only; not a status transition                                     |
| `FinanceTransaction.update` for `PENDING → COMPLETED`               | Payment lifecycle, not ledger tampering; amounts immutable                              |
| `DailyBillableSnapshot` lock/unlock via billing admin               | Super-admin / billing ops only; no institution self-serve mutation of historical counts |
| Full-stack E2E tenant isolation                                     | Covered by unit tests on guards; Testcontainers E2E deferred (repo-wide)                |

---

## Closed in Phase 16 follow-up

### MEDIUM — Finance transaction immutability

- `assertFinanceTransactionUpdateAllowed` blocks amount/type/account changes on non-`PENDING` rows.
- Completion requires `PENDING` status; gateway patches restricted via `pickGatewayOnlyUpdate`.

### MEDIUM — Entity isolation on student detail

- `StudentsService.getById` returns 404 when entity-scoped actor requests another campus student.

### MEDIUM — Cross-tenant E2E

- `apps/api/test/entity-isolation.e2e-spec.ts` (Testcontainers PostgreSQL). Run: `pnpm test:e2e` in `apps/api` (requires Docker).

### LOW — Presigned download URLs

- All storage download callers use `resolveDownloadUrl()` (presigned when S3 configured).

### LOW — Cursor pagination

- Shared `CursorPageQueryDto` / `sliceCursorPage`; applied to notifications, staff, progression, integrations lists.

### LOW — Load smoke

- `scripts/load-test/k6-smoke.js` documented in pen-test checklist.

---

## Verification commands

```bash
cd apps/api
pnpm test -- common/security common/pagination finance-transaction-immutability
pnpm test:e2e
pnpm typecheck
```

Pen-test checklist: [`docs/security/pen-test-checklist.md`](docs/security/pen-test-checklist.md)
