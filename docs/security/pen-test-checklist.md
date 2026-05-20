# UniCore Penetration Test Checklist (Phase 16)

Use this checklist for manual QA or external pen tests. Mark each item **Pass / Fail / N/A**.

## Billing integrity

- [ ] `grep` audit: no `student.update` with `enrollmentStatus` outside `StatusChangeService` (see `billing-integrity.audit.spec.ts`)
- [ ] Status change always creates `StatusChangeLog` row
- [ ] `StatusChangeLog` cannot be updated or deleted via API
- [ ] Backfill submit rejected when `billingAcknowledged` is false
- [ ] `DailyBillableSnapshot` not editable by institution users

## Tenant / entity isolation

- [ ] `pnpm test:e2e` in `apps/api` passes (Testcontainers; set `SKIP_TESTCONTAINERS=1` to skip in CI without Docker)
- [ ] User at Entity A cannot read Entity B student by ID (404/403)
- [ ] User at Institution 1 cannot pass `institutionId` for Institution 2 in body/query
- [ ] Affiliate public API: only `verify-student-enrollment` and `verify-transcript` without session
- [ ] `POST /auth/switch-entity` to `AFFILIATE` type blocked for normal staff
- [ ] Suspended institution returns 403 on authenticated routes

## Authentication

- [ ] 6th failed login within 15 minutes returns 429
- [ ] Refresh token rotation revokes prior refresh `jti`
- [ ] Access token blocked after entity switch (`accessJti` blocklist)
- [ ] MFA required when `mfaSecret` set

## Application security

- [ ] Helmet headers present (`X-Content-Type-Options`, `X-Frame-Options`, etc.)
- [ ] Upload `.png` file containing PDF bytes → rejected
- [ ] Upload PDF with correct magic bytes → accepted
- [ ] Payment webhooks reject invalid HMAC / signature
- [ ] Outbound integration webhooks use `verifyWebhookPayload` contract

## Encryption at rest

- [ ] Salary / gateway secrets stored as `{ _enc: true, payload: "..." }` in JSON columns
- [ ] `FIELD_ENCRYPTION_KEY` required in production

## Performance smoke

- [ ] `GET /health` < 50ms
- [ ] Authenticated list endpoint p99 < 300ms under k6 smoke (`scripts/load-test/k6-smoke.js`)
- [ ] `?fields=id,name` reduces list payload size

## Sign-off

| Role        | Name | Date |
| ----------- | ---- | ---- |
| Engineering |      |      |
| Security    |      |      |
