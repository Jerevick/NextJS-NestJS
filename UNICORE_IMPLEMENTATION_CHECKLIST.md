# UniCore — Implementation Checklist

Track progress against [`UNICORE_MASTER_PROMPT.md`](./UNICORE_MASTER_PROMPT.md) and [`.cursorrules`](./.cursorrules).

**Legend:** ✅ Done · 🟡 Partial · ⬜ Not started

**Last updated:** 2026-05-15 (Phase 7.2 + 5.3 snapshot pass)

---

## Roll-up summary

| Scope | Approx. complete |
|-------|------------------|
| **Phases 0–6** (foundation) | ~85% |
| **Phases 7–9** (SIS, LMS, Finance) | ~35% |
| **Phases 10–18** (extended + platform) | ~6% |
| **All phases (0–18)** | ~40% |

---

## Phase 0 — Monorepo & database schema (~95%)

### Prompt 0.1 — Monorepo initialization

| Item | Status |
|------|--------|
| `turbo.json` + pnpm workspace | ✅ |
| Root scripts (`dev`, `build`, `db:migrate`, `db:seed`, etc.) | ✅ |
| `packages/config` (ESLint, TS, Tailwind) | ✅ |
| `docker-compose.yml` (Postgres, Redis, Minio, Mailhog) | 🟡 — verify bull-board service |
| `.github/workflows` CI | 🟡 — `ci.yml` exists; per-app `api.yml` / `web.yml` / `admin.yml` as specified |
| `apps/api` + `apps/web` `.env.example` | 🟡 |
| Husky + commitlint | ✅ |
| App `src/` deferred in 0.1 (filled in later phases) | ✅ |

### Prompt 0.2 — Complete database schema

| Item | Status |
|------|--------|
| `packages/database/prisma/schema.prisma` (three-tier + billing) | ✅ |
| Migrations + seed (`demo-university`, super admin) | ✅ |
| `institutionId` + `entityId` on scoped models | 🟡 — audit remaining models |
| pgvector / pg_trgm extensions | 🟡 — confirm in compose/init |
| Shared `packages/types`, `ui`, `utils` | ✅ |

---

## Phase 1 — Auth, guards & entity switcher (~88%)

### Prompt 1.1 — NestJS auth system

| Item | Status |
|------|--------|
| JWT access + refresh, blocklist on inactivation | ✅ |
| `POST /auth/switch-entity` | ✅ |
| Email/password login | ✅ |
| Magic link OTP | ✅ |
| Google / Microsoft OAuth | 🟡 |
| SAML 2.0 | 🟡 |
| TOTP MFA (speakeasy) | ✅ |
| Tenant middleware + ALS (`tenant-als.ts`) | 🟡 — not full `prisma-tenant.middleware` auto-inject |
| `InstitutionScopeGuard` + `PermissionsGuard` | ✅ |
| `entity-scope.guard` / `position.guard` / `scope.guard` as named in prompt | 🟡 — patterns differ |
| `SuperAdminGuard` | ✅ |
| `AffiliateApiKeyGuard` + public verify API | ✅ |
| Rate limit on `/auth/*` | 🟡 |
| OpenAPI on all auth endpoints | 🟡 |
| Auth unit tests | 🟡 |

### Prompt 1.2 — StudentRecordPostingGuard

| Item | Status |
|------|--------|
| Global guard + `@StudentIdParam` | ✅ |
| ACTIVE → allow; INACTIVE → 403 | ✅ |
| Approved `BackfillWindow` → allow + `isBackfilled` | ✅ |
| `@BypassRecordGuard` + super admin only | 🟡 |
| Integration tests (`billing-integrity`, guard spec) | 🟡 |
| Applied on all student-write controllers | 🟡 — spot-audit per module |

### Prompt 1.3 — Next.js auth + entity switcher

| Item | Status |
|------|--------|
| NextAuth v5 (`apps/web`) | ✅ |
| Login / register / forgot-password | ✅ |
| `EntitySwitcher` component | ✅ |
| Fresh JWT on entity switch | 🟡 — depends on web→API wiring |
| Protected `(institution)` layout shell | 🟡 — flat `app/` routes today |

---

## Phase 2 — Institution entity module (~88%)

### Prompt 2.1 — InstitutionEntity backend

| Item | Status |
|------|--------|
| Entity CRUD (dual-scoped) | ✅ |
| `EntityProvisioningService` (org tree, workflows, head position) | ✅ |
| BullMQ `entity-provision` job | 🟡 |
| Block delete if ACTIVE students | 🟡 |
| Affiliate link creation | 🟡 |

### Prompt 2.2 — Entity management + switcher UI

| Item | Status |
|------|--------|
| `/entities` list | ✅ |
| `/entities/new` | ✅ |
| `/entities/[id]` detail | ✅ |
| Branding / settings UI | 🟡 |
| Entity switcher in main shell topbar | 🟡 — on entities page, not global topbar |

---

## Phase 3 — Org structure & positions (~80%)

### Prompt 3.1 — Org structure backend

| Item | Status |
|------|--------|
| OrgUnit CRUD (hierarchy) | ✅ |
| Positions + permission bundles | ✅ |
| Entity-type org templates | ✅ |
| User ↔ position assignment | 🟡 |
| `@RequirePosition` / scope guards on writes | 🟡 |

### Prompt 3.2 — Org chart UI

| Item | Status |
|------|--------|
| `/settings/org-structure` | 🟡 — tree list, not ReactFlow |
| `/settings/positions` | ✅ |
| ReactFlow org chart | ⬜ |

---

## Phase 4 — Workflow engine (~78%)

### Prompt 4.1 — Workflow engine backend

| Item | Status |
|------|--------|
| `WorkflowEngineModule` (definitions, instances, steps) | ✅ |
| Seeded workflows (reactivation, backfill, grade, deletion, etc.) | 🟡 |
| Completion handlers → `StatusChangeService` | ✅ |
| Position-based step routing | 🟡 |

### Prompt 4.2 — Workflow inbox UI

| Item | Status |
|------|--------|
| `/workflow/inbox` | ✅ |
| `/workflow/initiated` | ✅ |
| `/workflow/[instanceId]` review | ✅ |
| Action panel + timeline polish | 🟡 |

---

## Phase 5 — Billing engine (~83%)

### Prompt 5.1 — Billing snapshot & invoice services

| Item | Status |
|------|--------|
| `BillingSnapshotService` (ACTIVE-only count) | ✅ |
| Daily snapshot immutability | ✅ |
| `MonthlyBillableSummary` / watermark logic | ✅ |
| `BillingInvoiceService` (draft, lock, evidence S3) | ✅ |
| `BillingDisputeService` (initiate + auto-validate) | 🟡 |
| BullMQ: daily / monthly / lock / retroactive processors | ✅ (when `REDIS_URL` set) |
| Institution billing controller (read-only snapshots) | ✅ |
| Super-admin snapshot amend + dispute resolve | ✅ |
| Stripe webhook controller | 🟡 |

### Prompt 5.2 — Status change & backfill services

| Item | Status |
|------|--------|
| `StatusChangeService` sole writer of `enrollmentStatus` | ✅ |
| Synchronous session invalidation on INACTIVE | ✅ |
| Immutable `StatusChangeLog` | ✅ |
| `BackfillRequestService` + workflow | ✅ |
| Retroactive invoice on approval | ✅ |
| `StudentDeletionService` + permanent deletion workflow | ✅ |
| Reactivation requests | ✅ |

### Prompt 5.3 — Billing dashboard UI (`apps/web`)

| Item | Status |
|------|--------|
| `/billing` overview + trend chart | 🟡 |
| `/billing/snapshot` dedicated history page | 🟡 |
| `/billing/invoice/[id]` + dispute UI | 🟡 |
| `/billing/disputes` tracker | 🟡 |
| `InactiveStudentBanner` on student profile | ✅ |
| `StudentStatusTimeline` | 🟡 — present; Framer Motion / full fields TBD |
| Read-only mode for INACTIVE students | 🟡 |
| Admin platform revenue + world map (Prompt 5.3 §6) | ⬜ / 🟡 — basic disputes only |

---

## Phase 6 — Super admin platform (~82%)

### Prompt 6.1 — Super admin backend

| Item | Status |
|------|--------|
| `SuperAdminModule` + `SuperAdminGuard` | ✅ |
| `POST /super-admin/institutions` provision | ✅ |
| List / detail / patch / suspend / activate | ✅ |
| `InstitutionHealthService` + anomaly detection | ✅ |
| `FeatureFlagsService` (platform + institution overrides) | ✅ |
| Super-admin billing (disputes, amend, lock, generate invoice) | ✅ |
| `MonitoringModule` | 🟡 |
| `SubscriptionsModule` Stripe (customer, webhooks, auto-suspend) | ⬜ |
| Daily health-score BullMQ cron | ⬜ |
| Monitoring WebSocket gateway | ⬜ |

### Prompt 6.2 — Super admin frontend (`apps/admin`)

| Item | Status |
|------|--------|
| `/dashboard` KPIs + anomalies | 🟡 — no MRR chart / map / live sessions |
| `/institutions` table | 🟡 — basic table |
| `/institutions/new` onboard form | 🟡 — single form, not 5-step wizard |
| `/institutions/[id]` tabs (entities, billing, audit) | 🟡 |
| `/billing` + `/billing/disputes/[id]` | 🟡 |
| Danger zone (suspend/terminate) | ⬜ |
| Feature flags UI | ⬜ |

---

## Phase 7 — SIS (~55%)

### Prompt 7.1 — SIS backend

| Module | Status | Gaps |
|--------|--------|------|
| **StudentsModule** | 🟡 | CRUD, status logs, permanent deletion; missing bulk CSV, tsvector search, `confirm-graduation`, computed GPA fields in list |
| **AdmissionsModule** | 🟡 | Cycles, applications, forms; missing offer PDF, acceptance → auto student |
| **EnrollmentModule** | 🟡 | Enroll/drop; missing waitlist, holds, mass CSV, timetable conflict |
| **GradesModule** | 🟡 | Entry basics; missing full workflow release, override chain, component weights |
| **AttendanceModule** | 🟡 | Sessions; missing QR scan flow, offline bulk sync |
| **DocumentsModule** | 🟡 | Requests; missing public `/verify/:code`, clearance workflow |
| **TranscriptsModule** | 🟡 | Separate module exists |
| **StudentRecordPostingGuard** on all writes | 🟡 | Audit coverage |

### Prompt 7.2 — SIS frontend (`apps/web`)

| Item | Status |
|------|--------|
| `/students` registry (filters, entity tabs, TanStack Table) | 🟡 |
| `/students/[id]` profile (tabs, inactive banner, timeline) | 🟡 |
| `/students/new`, enroll, bulk-enroll, reactivation | 🟡 |
| `/admissions` funnel + kanban | 🟡 — list + funnel + detail (no kanban drag) |
| `/enrollment/register` student course registration | 🟡 — under `/students/.../enroll` |
| `/grades/entry` faculty grade entry | 🟡 |
| `/students/[id]` attendance + status tabs | 🟡 |
| Premium design system (navy/amber, Crimson Pro) | ⬜ |
| AI insights panel on student profile | ⬜ |

---

## Phase 8 — LMS (~38%)

### Prompt 8.1 — LMS backend

| Item | Status |
|------|--------|
| Course instances, modules, lessons CRUD + reorder | ✅ |
| Lesson resources | 🟡 |
| Video upload → transcode → HLS | ⬜ |
| SCORM runtime | ⬜ |
| **AssessmentsModule** (quiz engine, assignments) | ⬜ |
| **ProgressModule** (complete, heartbeat, certificates) | ⬜ |
| AI lesson summary / question generation | ⬜ |
| Grade passback to SIS | ⬜ |

### Prompt 8.2 — LMS frontend

| Item | Status |
|------|--------|
| `/courses` + `/courses/[id]` + lessons | 🟡 |
| `/teach/[courseId]` builder | 🟡 — placeholder for DnD/assessments |
| `/lms` student dashboard | ⬜ |
| HLS video player | ⬜ |
| Quiz engine component | ⬜ |
| AI tutor panel | ⬜ |

---

## Phase 9 — Finance (~2%)

### Prompt 9.1 — Finance backend & frontend

| Item | Status |
|------|--------|
| `FinanceModule` (fees, payments, accounts, scholarships) | ⬜ |
| Payment gateways (Stripe, Flutterwave, Paystack, Paymob) | ⬜ — Stripe webhook only for billing |
| Institution `/finance/*` pages | ⬜ |
| Student financial tab on profile | ⬜ |

---

## Phase 10 — HR & staff (~0%)

### Prompt 10.1

| Item | Status |
|------|--------|
| Staff profiles, leave, appraisals, workload | ⬜ |
| `/staff/*` UI | ⬜ |

---

## Phase 11 — Elections & meetings (~0%)

### Prompt 11.1 — Elections

| Item | Status |
|------|--------|
| Blind-signature voting, booths, results | ⬜ |

### Prompt 11.2 — Meetings + AI minutes

| Item | Status |
|------|--------|
| Meetings, governance, AI minutes | ⬜ |

---

## Phase 12 — Alumni & sports (~0%)

### Prompt 12.1 — Alumni

| Item | Status |
|------|--------|
| Directory, events, mentorship | ⬜ |

### Prompt 12.2 — Sports

| Item | Status |
|------|--------|
| Teams, fixtures, eligibility | ⬜ |

---

## Phase 13 — AI intelligence layer (~3%)

### Prompt 13.1

| Item | Status |
|------|--------|
| `AIModule` + RAG (pgvector embeddings) | ⬜ |
| AI tutor (SSE) | ⬜ |
| Academic risk / advisor / insights | ⬜ |
| Billing anomaly (health service) | 🟡 |

---

## Phase 14 — Notifications & customization (~2%)

### Prompt 14.1 — Notification engine

| Item | Status |
|------|--------|
| Multi-channel (email, SMS, push, in-app) | ⬜ |
| BullMQ notification processors | ⬜ |

### Prompt 14.2 — Customization engine

| Item | Status |
|------|--------|
| Institution/entity branding UI | 🟡 |
| Custom forms builder | ⬜ |

---

## Phase 15 — Student & guardian portals (~5%)

### Prompt 15.1 — Student portal

| Item | Status |
|------|--------|
| Dedicated student shell + routes | ⬜ |
| Self-service registration, grades, LMS, fees | ⬜ |

### Prompt 15.2 — Guardian portal

| Item | Status |
|------|--------|
| Guardian auth + linked students view | ⬜ |

---

## Phase 16 — Security audit & performance (~8%)

### Prompt 16.1 — Security audit

| Item | Status |
|------|--------|
| Cross-tenant / cross-entity leak tests | 🟡 |
| Guard coverage audit | 🟡 |
| Pen-test checklist / ADRs | ⬜ |

### Prompt 16.2 — Performance

| Item | Status |
|------|--------|
| Cursor pagination everywhere | 🟡 |
| Query indexes / N+1 review | ⬜ |
| Load testing | ⬜ |

---

## Phase 17 — DevOps & monitoring (~15%)

### Prompt 17.1 — Production infrastructure

| Item | Status |
|------|--------|
| `docker-compose.prod.yml` | 🟡 |
| Per-app Dockerfiles | 🟡 |
| GitHub Actions deploy pipelines | 🟡 |
| `GET /health` | ✅ |
| Monitoring API + admin dashboard hooks | 🟡 |
| Structured logging + correlation IDs | 🟡 |
| Sentry / Datadog | ⬜ |

---

## Phase 18 — Integrations & public API (~5%)

### Prompt 18.1

| Item | Status |
|------|--------|
| Affiliate verify API (student/transcript) | 🟡 |
| Zoom / WhatsApp / calendar integrations | ⬜ |
| Public API + marketplace | ⬜ |
| Webhook framework | ⬜ |

---

## Cross-cutting — Definition of Done (all phases)

| Requirement | Status |
|-------------|--------|
| TypeScript strict, no `any` | 🟡 |
| 80%+ test coverage per module | ⬜ (~11 spec files today) |
| OpenAPI on every endpoint | 🟡 |
| Audit log on every mutation | 🟡 |
| Cursor-based list pagination | 🟡 |
| Soft delete only in services | 🟡 |

---

## Suggested next work (prompt order)

1. **Phase 7.2** — `/admissions`, `/grades/entry`, full `/students/[id]` tabs  
2. **Phase 5.3** — `/billing/snapshot`, polish invoice dispute UX  
3. **Phase 7.1** — graduation confirm, enrollment holds/waitlist, document verify endpoint  
4. **Phase 8** — assessments + progress backends, then LMS student UI  
5. **Phase 9** — Finance module (unblocks student financial tab)

---

## How to update this file

When completing a prompt item, change its status in the table and bump **Last updated**. Recompute phase % if a whole prompt block is done.

Reference line numbers in `UNICORE_MASTER_PROMPT.md` via the phase headers (e.g. `# PHASE 7 — STUDENT INFORMATION SYSTEM`).
