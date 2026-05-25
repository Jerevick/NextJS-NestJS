# UniCore — 100% Completion Roadmap

**Source of truth:** `UNICORE_MASTER_PROMPT.md` v5.0 + `.cursorrules`  
**Baseline audit:** May 2026 (repo state: broad module coverage; gaps in tenancy hardening, ops, enterprise auth, LMS depth, admin UX, quality gates)

**Last implementation pass (May 2026):** Critical-path work packages landed in code — see [Implemented in repo](#implemented-in-repo-may-2026) below. Remaining WPs still require dedicated chats.  
**How to use:** Run prompts **in order** within each phase. Open a **new Cursor chat per work package**. Tag `@UNICORE_MASTER_PROMPT.md` and `@.cursorrules`. Paste the **Agent prefix** below every time.

---

## Agent prefix (required)

```text
You are a senior full-stack engineer building UniCore, an enterprise university SIS+LMS SaaS.
Read .cursorrules at the monorepo root for all laws, standards, and architectural decisions.
Never violate those laws. Write production-grade code only. No placeholders. No TODOs.
Minimize scope to the work package ID stated in the prompt. Match existing naming and patterns.
```

## Completion tracker

| Phase | Theme                            | Est. completion | Work packages                  |
| ----- | -------------------------------- | --------------- | ------------------------------ |
| 0     | Monorepo & infra shell           | ~75%            | WP-0.1 … WP-0.4                |
| 1     | Auth, tenancy, guards            | ~70%            | WP-1.1 … WP-1.5                |
| 2–5   | Entities, org, workflow, billing | ~85%            | WP-2.1, WP-3.1, WP-4.1, WP-5.1 |
| 6     | Super admin                      | ~60%            | WP-6.1, WP-6.2                 |
| 7     | SIS                              | ~80%            | WP-7.1 … WP-7.4                |
| 8     | LMS                              | ~65%            | WP-8.1 … WP-8.4                |
| 9     | Finance                          | ~75%            | WP-9.1, WP-9.2                 |
| 10    | HR                               | ~70%            | WP-10.1                        |
| 11    | Elections & meetings             | ~70%            | WP-11.1, WP-11.2               |
| 12    | Alumni & sports                  | ~70%            | WP-12.1, WP-12.2               |
| 13    | AI layer                         | ~65%            | WP-13.1 … WP-13.3              |
| 14    | Notifications & customization    | ~75%            | WP-14.1, WP-14.2               |
| 15    | Student & guardian portals       | ~85%            | WP-15.1                        |
| 16    | Security & performance           | ~50%            | WP-16.1, WP-16.2               |
| 17    | DevOps & monitoring              | ~15%            | WP-17.1 … WP-17.3              |
| 18    | Integrations & public API        | ~55%            | WP-18.1 … WP-18.3              |
| 19    | Academic progression             | ~80%            | WP-19.1                        |
| X     | Cross-cutting hardening          | ~60%            | WP-X.1 … WP-X.5                |

**Definition of 100%:** Every work package’s acceptance checklist is green; CI runs lint, typecheck, unit tests, Testcontainers e2e, coverage ≥ 80% on `apps/api`; staging deploy succeeds; pen-test checklist in `docs/security/pen-test-checklist.md` fully checked.

---

## Execution order (critical path)

```text
WP-X.1 → WP-1.1 → WP-1.2 → WP-0.* → WP-5.1 (verify) → WP-7.* → WP-8.* → WP-9.* →
WP-6.* → WP-13.* → WP-14.* → WP-16.* → WP-17.* → WP-18.* → WP-19.1 → WP-X.2 … WP-X.5
```

Parallelizable after WP-1.2: WP-10.1, WP-11._, WP-12._, WP-15.1 (if not blocked by guards).

---

## Implemented in repo (May 2026)

See **[PHASE_IMPLEMENTATION_STATUS.md](./PHASE_IMPLEMENTATION_STATUS.md)** for the phase-by-phase rollup.

| WP         | Status | Notes                                                                                                                                       |
| ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| WP-0.1     | Done   | `turbo.json` db:migrate/db:seed/test; Docker stack + Bull Board; `docker/README.md`; Prisma 6 pin; `20260519110000_org_structure` migration |
| WP-0.2–0.4 | Done   | CI, API/web/admin Dockerfiles, `scripts/schema-audit.mjs`, `docs/schema-audit-2026-05-22.md`                                                |
| WP-1.1–1.3 | Done   | Tenant Prisma extension, entity/position/scope guards                                                                                       |
| WP-1.4     | Done   | `SamlAuthService`, ACS/login/metadata, `docs/saml-dev.md`                                                                                   |
| WP-1.5     | Done   | `TenantMiddleware` subdomains, `apps/web/middleware.ts`, hooks/gates                                                                        |
| WP-1.6     | Done   | `AffiliateApiKeyGuard`                                                                                                                      |
| WP-4.1     | Done   | `docs/workflow-coverage.md`                                                                                                                 |
| WP-5.1     | Done   | Billing queue retention `removeOnComplete/Fail: false`                                                                                      |
| WP-X.1     | Done   | Soft-delete audit + agenda `deletedAt`                                                                                                      |

**Still open (next chats):** WP-6.2 admin UX, WP-8.x LMS (SCORM/HLS), WP-17 k8s/observability, WP-18 deep integrations, WP-16.2 coverage gate, WP-19.1 full release tests.

---

# PHASE 0 — Monorepo & database shell

## WP-0.1 — Turbo pipeline & local Docker parity

**Gap:** `turbo.json` missing `db:migrate`, `db:seed`, `test`; Docker missing Bull Board, Postgres healthchecks, pgvector init, MinIO bucket bootstrap.

### Implementation prompt

```text
[AGENT A] Work package WP-0.1 only.

1. Update root turbo.json:
   - Add tasks: db:migrate, db:seed, test (with correct dependsOn and cache:false for DB).
   - Wire outputs for test coverage if emitted.

2. Extend docker-compose.yml:
   - postgres:16-alpine: healthcheck, volume, init script at docker/postgres/init.sql that enables
     extensions: vector, pg_trgm, uuid-ossp (or pgcrypto).
   - redis:7-alpine: command with appendonly yes + healthcheck.
   - minio: add minio/mc sidecar or entrypoint script to create bucket `unicore` on start.
   - mailhog: keep ports 1025/8025.
   - bull-board: expose :3001, connect to REDIS_URL, list all BullMQ queues used in apps/api.

3. Add docker/README.md with: docker compose up, migrate, seed, URLs for Mailhog and Bull Board.

4. Root package.json: `db:studio`, `clean`, `test` → `turbo run test`; workspace packages define `clean` (api/web/admin/database/types/utils).

Acceptance:
- [x] docker compose up -d → all services healthy (see `docker/README.md`)
- [x] psql can `CREATE EXTENSION vector` (init.sql + README verify command)
- [x] Bull Board at :3001 (queues listed in README; visible after API uses Redis)
- [x] `pnpm db:migrate` && `pnpm db:seed` from repo root (Prisma 6.19.3; local `packages/database/.env`)
```

---

## WP-0.2 — CI/CD foundation (PR gate)

**Gap:** `.github/workflows/ci.yml` has no Postgres service, no `pnpm test`, no e2e, no Docker build.

### Implementation prompt

```text
[AGENT B] Work package WP-0.2 only.

1. Split or extend GitHub Actions:
   - ci.yml: on PR/push — checkout, pnpm install, lint, typecheck, unit test (apps/api jest),
     start postgres:16 service container with pgvector image or init script,
     run prisma migrate deploy, pnpm test:e2e in apps/api (SKIP_TESTCONTAINERS=0 when service used).
   - Optional: fail if coverage < 80% once WP-16.2 enables threshold.

2. Add apps/api/.env.ci with documented vars (mirror existing CI env block).

3. Document in docs/UNICORE_100_PERCENT_COMPLETION.md § CI how to run e2e locally.

Acceptance:
- [ ] PR workflow green on clean clone
- [ ] entity-isolation.e2e-spec.ts and register-institution.e2e-spec.ts run in CI
- [ ] Failed migration fails the job
```

---

## WP-0.3 — Per-app Dockerfiles & .dockerignore

**Gap:** No production Docker images.

### Implementation prompt

```text
[AGENT B] Work package WP-0.3 only.

Create multi-stage Alpine Dockerfiles:
- apps/api/Dockerfile: deps → build (nest build + prisma generate) → prod node:20-alpine, USER 1001,
  HEALTHCHECK GET /health, EXPOSE 3000, CMD node dist/main.js
- apps/web/Dockerfile: Next.js standalone output pattern
- apps/admin/Dockerfile: same as web
Add .dockerignore per app (node_modules, .next, dist, .env*).

Acceptance:
- [ ] docker build -f apps/api/Dockerfile . produces runnable image
- [ ] GET /health returns ok inside container
- [ ] Images run as non-root
```

---

## WP-0.4 — Schema audit vs master Prompt 0.2

**Gap:** Ongoing drift between schema and master model list.

### Implementation prompt

```text
[AGENT A] Work package WP-0.4 only.

1. Read UNICORE_MASTER_PROMPT.md Prompt 0.2 model list and .cursorrules §5–8.
2. Diff packages/database/prisma/schema.prisma against required platform + scoped models.
3. Add missing models/fields/indexes via migration (no destructive drops without comment).
4. Ensure every scoped model has: institutionId, entityId, createdAt, updatedAt, deletedAt,
   @@index([institutionId, entityId, deletedAt]).

Deliverable: docs/schema-audit-YYYY-MM-DD.md listing resolved gaps.

Acceptance:
- [ ] prisma validate passes
- [ ] migrate deploy on empty DB succeeds
- [ ] Audit doc shows zero P0 missing models
```

---

# PHASE 1 — Authentication, tenancy & guards

## WP-1.1 — Prisma tenant middleware (dual-scope injection)

**Gap:** `PrismaService` has no auto-filter; only ALS + manual repository filters.

### Implementation prompt

```text
[AGENT A] Work package WP-1.1 only.

Implement apps/api/src/prisma/prisma-tenant.middleware.ts (or $extends):

1. Read tenant store from tenantAls: { institutionId, entityId?, entityScope, bypass? }.
2. For models in TENANT_SCOPED_MODELS list (generate from schema — all with institutionId):
   - entityScope ENTITY: inject where { institutionId, entityId, deletedAt: null }
   - entityScope ALL: inject where { institutionId, deletedAt: null }
3. Super-admin bypass flag skips injection.
4. On findFirst/findMany/update without institutionId in where for scoped models: log CRITICAL + throw in dev.

Wire in PrismaService constructor via $extends.

Add integration test: user scoped to entity A cannot read entity B row via raw prisma call.

Acceptance:
- [ ] No service manually adds institutionId unless documented exception
- [ ] entity-isolation e2e still passes
- [ ] Bypass only when AsyncLocalStorage bypass=true
```

---

## WP-1.2 — Entity scope guard & resource ownership

**Gap:** `InstitutionScopeGuard` checks body/query institutionId only, not route resource entityId.

### Implementation prompt

```text
[AGENT A] Work package WP-1.2 only.

1. Create apps/api/src/common/guards/entity-scope.guard.ts:
   - For users with entityScope ENTITY: resolve resource entityId from params/body (decorator metadata
     @ResourceEntityId('studentId' | 'entityId' path)).
   - Compare to user.entityId; 403 if mismatch.
   - ALL-scope users pass; super-admin * passes.

2. Add decorator @ResourceEntityId(paramPath) and register guard globally AFTER JwtAuthGuard
   (or apply per-controller for performance).

3. Audit controllers: students, grades, enrollment, finance, lms student routes — must use guard.

4. Keep InstitutionScopeGuard for cross-tenant body injection attacks.

Acceptance:
- [ ] Integration test: Entity B JWT cannot GET /students/:id for Entity A student
- [ ] OpenAPI documents 403 entity mismatch
```

---

## WP-1.3 — Position & scope guards (governance model)

**Gap:** No `@RequirePosition`, `PositionGuard`, `ScopeGuard`; permissions-only model.

### Implementation prompt

```text
[AGENT A] Work package WP-1.3 only.

Per UNICORE_MASTER_PROMPT.md Prompt 1.1 Part H:

1. position.guard.ts — reads @RequirePosition(...codes) metadata; checks JWT positionCode.
2. scope.guard.ts — reads @RequireScope(FACULTY|DEPARTMENT|INSTITUTION|...); validates
   positionScope + orgUnitId jurisdiction against target resource OrgUnit (helper service).
3. Decorators: @RequirePosition, @RequireScope, @CurrentPosition(), @CurrentEntity().

4. Migrate high-risk write endpoints (grades entry, status change, billing amend, finance refund)
   from roles-only to position+permission.

5. Unit tests per guard with mocked ExecutionContext.

Acceptance:
- [ ] Lecturer cannot grade section outside scope (403)
- [ ] Dean can grade within faculty scope only
- [ ] Decorators documented in Swagger where used
```

---

## WP-1.4 — SAML 2.0 & enterprise SSO completion

**Gap:** `saml-auth.controller.ts` is NOT_IMPLEMENTED stub.

### Implementation prompt

```text
[AGENT B] Work package WP-1.4 only.

Replace SAML placeholder with passport-saml integration:

1. Institution.settings: ssoProvider SAML, idpMetadataUrl or cert, entryPoint, issuer, callbackUrl.
2. GET /auth/saml/metadata — SP metadata XML from institution config.
3. POST /auth/saml/acs — validate assertion, map NameID to User, issue JWT pair, MFA if enabled.
4. Encrypt sensitive IdP config with existing field encryption util.
5. Rate-limit ACS endpoint.

Acceptance:
- [ ] SAML flow e2e with mock IdP (e.g. samltest.id or docker saml-idp) documented in docs/saml-dev.md
- [ ] No stub NOT_IMPLEMENTED responses remain
```

---

## WP-1.5 — Tenant resolver: entity subdomains & web middleware

**Gap:** No `ext.unilag.unicore.io` → entity code resolution; web middleware incomplete vs Prompt 1.3.

### Implementation prompt

```text
[AGENT B + AGENT C] Work package WP-1.5 only.

API — extend TenantMiddleware:
- Parse host: {entityCode}.{instSlug}.{APP_ROOT_DOMAIN} → set req.entity + headers.
- Cache institution 5m, entity 5m in Redis (already partial — complete parity).

Web — apps/web/middleware.ts:
- Map entity subdomain → set X-Entity-ID on API proxy / server fetches.
- Route guards: /entities/* ALL only; /billing/* permission; /teach/* position level ≤7.

Hooks (verify or create):
- useEntityContext, useStudentStatus, usePermission, usePosition in apps/web/src/hooks/

Components: EntityScopeGate, PermissionGate, PositionGate.

Login flow: 4-step wizard per Prompt 1.3 (institution → entity → credentials/SSO → MFA).

Acceptance:
- [ ] ext.slug.domain resolves correct entity in API logs
- [ ] switchEntity updates session entityId
- [ ] INACTIVE student forms disabled via useStudentStatus
```

---

## WP-1.6 — Affiliate API key guard

**Gap:** No `affiliate-api-key.guard.ts` for EXTERNAL coupling institutions.

### Implementation prompt

```text
[AGENT A] Work package WP-1.6 only.

1. affiliate-api-key.guard.ts — validates X-API-Key against AffiliateApiKey table, scopes to
   institutionId, EXTERNAL entity only.
2. Restrict affiliate controllers to: verify-student, verify-transcript, no bulk export.
3. Audit spec: affiliate key cannot call /students list or /grades.

Acceptance:
- [ ] Integration test in apps/api/test/affiliate-scope.e2e-spec.ts
```

---

# PHASE 2 — Institution entities

## WP-2.1 — Entity provisioning & stats parity

**Gap:** Verify provisioning job steps ii–vii, consolidated stats for VC dashboard.

### Implementation prompt

```text
[AGENT B] Work package WP-2.1 only.

Audit apps/api/src/institution-entities/entity-provisioning.processor.ts against Prompt 2.1:
- Default OrgUnit trees per EntityType (MAIN_CAMPUS, EXTRAMURAL, SCHOOL, DL, AFFILIATE).
- Clone workflow definitions from institution templates.
- BILLED_INDEPENDENTLY → separate Subscription.
- getEntityStats + getConsolidatedStats endpoints for VC dashboard.

Frontend apps/web/src/app/entities/* — billable count in entity switcher dropdown.

Acceptance:
- [ ] New entity reaches ACTIVE < 60s in dev
- [ ] Entity switcher shows billable count from latest snapshot
- [ ] Only one MAIN_CAMPUS per institution enforced
```

---

# PHASE 3 — Org structure

## WP-3.1 — Org chart UI (@xyflow) & position authority data

**Gap:** Full interactive org chart vs list may be incomplete.

### Implementation prompt

```text
[AGENT C] Work package WP-3.1 only.

1. apps/web — org chart page using @xyflow/react:
   - Fetch GET /org-structure/tree or /staff/org-chart?entityId=
   - Nodes: OrgUnit; edges: parent; avatars for PositionHolder.
   - Pan/zoom, minimap, click → staff profile.

2. Ensure API returns nested structure with position holders per Prompt 3.2.

Acceptance:
- [ ] Org chart renders 100+ nodes without layout break
- [ ] Click node opens holder detail
```

---

# PHASE 4 — Workflow engine

## WP-4.1 — Workflow coverage audit

**Gap:** Some modules may bypass WorkflowEngine for approvals.

### Implementation prompt

```text
[AGENT D] Work package WP-4.1 only.

1. Grep apps/api for approval patterns outside workflow-engine (status change, grade release,
   backfill, scholarship, leave, refund, progression).
2. Wire missing flows to WorkflowDefinition codes in seed.
3. Ensure workflow/inbox UI shows SLA warnings (Prompt 4.2).

Deliverable: docs/workflow-coverage.md with every approval path → workflow code.

Acceptance:
- [ ] Zero ad-hoc multi-step approval in services (grep audit clean)
- [ ] Grade release requires Dean + Registrar steps
```

---

# PHASE 5 — Billing engine

## WP-5.1 — Billing jobs reliability & institution UI polish

**Gap:** Verify dedup jobIds, dispute window, retroactive billing order.

### Implementation prompt

```text
[AGENT A] Work package WP-5.1 only.

Per Prompt 5.1–5.2 and Phase 17 billing job section:

1. BullMQ jobs: jobId dedup daily-snap-{inst}-{entity}-{date}, monthly-{inst}-{month}.
2. attempts:3, exponential backoff 5000ms, removeOnComplete/Fail false.
3. RetroactiveBillingJob completes BEFORE BackfillWindow activation.
4. apps/web billing pages: StatusTimeline, BackfillModal, billing preview on status change.

Acceptance:
- [ ] Double cron fire does not duplicate snapshot row
- [ ] Backfill approval creates retroactive invoice before window opens
- [ ] billing-integrity.audit.spec.ts passes
```

---

# PHASE 6 — Super admin

## WP-6.1 — Super admin backend completeness

**Gap:** Feature flags %, Stripe subscription lifecycle, WebSocket monitoring gateway.

### Implementation prompt

```text
[AGENT B] Work package WP-6.1 only.

Per Prompt 6.1:

1. FeatureFlagsModule: global + per-institution override + percentage rollout.
2. SubscriptionsModule: Stripe customer/subscription/webhooks; grace 14d → suspend.
3. MonitoringModule WebSocket: active session counts per institution (use SessionsModule gateway).
4. InstitutionHealthService daily cron via BullMQ.

Acceptance:
- [ ] POST /super-admin/institutions creates VC + provisions entity
- [ ] WebSocket emits session counts to super-admin clients
- [ ] Feature flag at 10% affects only subset of institutions (test)
```

---

## WP-6.2 — Super admin frontend (Bloomberg-grade)

**Gap:** No world map, MRR chart, 5-step wizard, live sessions, expandable institution rows.

### Implementation prompt

```text
[AGENT C] Work package WP-6.2 only.

Upgrade apps/admin to Prompt 6.2 spec:

1. /dashboard — recharts MRR 12mo line; react-simple-maps institution pins by plan;
   WebSocket "N users online"; remove mock fallback when ADMIN_API_BEARER set (fail loud in prod).
2. /institutions — TanStack Table: health ring, progress bar students/max, expandable entity rows,
   bulk suspend, CSV export.
3. /institutions/new — 5-step wizard (details → billing → admin user → modules → review).
4. /institutions/[id] — tabs: Overview | Entities | Billing | Modules | Subscription | Audit | Danger;
   amend snapshot modal with mandatory reason; typed slug confirm on suspend.

Design: #0a0a0a bg, JetBrains Mono for numbers, Geist Sans UI.

Acceptance:
- [ ] No mock mode in production build (env validation)
- [ ] World map shows ≥1 institution pin from API
- [ ] Wizard creates institution end-to-end
```

---

# PHASE 7 — SIS

## WP-7.1 — SIS backend hardening

**Gap:** Full-text search, graduation flow, inter-entity enrollment, guard coverage on all writes.

### Implementation prompt

```text
[AGENT B] Work package WP-7.1 only.

Per Prompt 7.1:

1. Student search: tsvector on name, studentNumber, email (Prisma fullTextSearch or raw SQL).
2. confirmGraduation → StatusChangeService INACTIVE GRADUATED + instant logout only path.
3. Inter-entity enrollment validates SharedCourse.
4. Audit ALL student-write controllers for StudentRecordPostingGuard + backfillContext.
5. Bulk CSV import BullMQ; offer letter Handlebars + puppeteer → S3.

Acceptance:
- [ ] guard-coverage.audit.spec.ts extended for grades, attendance, enrollment, documents
- [ ] Graduation stops billing from status change timestamp
- [ ] Search returns relevant student < 200ms on 10k seed
```

---

## WP-7.2 — SIS frontend polish

**Gap:** What-if GPA, WebSocket seat counts, AI insights panel integration, kanban drag permissions.

### Implementation prompt

```text
[AGENT C] Work package WP-7.2 only.

1. /students/[id] — What-if GPA calculator (client-side from loaded enrollments).
2. Wire StudentAiAdvisorPanel into Academic tab with cached narrative + risk level badge.
3. /enrollment/register — WebSocket room per sectionId for seats remaining.
4. /admissions — kanban drag requires admissions.write; funnel chart accurate.
5. INACTIVE: InactiveStudentBanner on all write surfaces (already partial — complete).

Acceptance:
- [ ] INACTIVE student cannot submit registration (UI + API)
- [ ] Seat count updates within 2s of another registration
```

---

## WP-7.3 — Attendance offline PWA

**Gap:** API sync exists; no offline-first scanner UX.

### Implementation prompt

```text
[AGENT C] Work package WP-7.3 only.

1. apps/web PWA route /attendance/scan-offline:
   - Service worker caches shell; IndexedDB queue of scans (sessionId, studentId, ts).
2. On reconnect: POST /sync/attendance/bulk (existing API).
3. html5-qrcode for QR; validate expiry client-side from session payload.

Acceptance:
- [ ] Airplane mode: scan queues; online sync posts records
- [ ] Duplicate scan idempotent server-side
```

---

## WP-7.4 — Documents & verification public endpoint

**Gap:** Verify public GET /verify/:code and QR on PDFs.

### Implementation prompt

```text
[AGENT B] Work package WP-7.4 only.

1. Public verification endpoint no auth — returns valid, type, issuedDate, revoked.
2. Document PDF template includes QR linking to verification URL.
3. Graduation clearance workflow wired to WorkflowEngine.

Acceptance:
- [ ] Expired/revoked doc returns valid:false
- [ ] e2e: issue doc → verify → revoke → verify fails
```

---

# PHASE 8 — LMS

## WP-8.1 — Video transcode pipeline (HLS)

**Gap:** HLS player in web; no FFmpeg/MediaConvert job in API.

### Implementation prompt

```text
[AGENT B] Work package WP-8.1 only.

1. On lesson video upload complete (S3 webhook or poll):
   BullMQ TranscodeLessonVideoJob → FFmpeg HLS renditions → upload .m3u8 + segments to S3.
2. Store lesson.videoHlsKey, duration, renditions in DB.
3. Env: TRANSCODE_MODE=local|mediaconvert; document resource requirements.

Acceptance:
- [ ] Upload MP4 → within 5 min lesson plays in HlsVideoPlayer
- [ ] Failed transcode retries 3x and surfaces lesson status FAILED_TRANSCODE
```

---

## WP-8.2 — SCORM 1.2/2004 runtime

**Gap:** Schema enum only.

### Implementation prompt

```text
[AGENT B] Work package WP-8.2 only.

1. SCORM package upload → unzip to S3 prefix; create ScormPackage record.
2. Launch URL: /lms/scorm/launch/:lessonId — iframe + SCORM API adapter (cmi.core.*).
3. Persist progress via SCORM commit → StudentProgress updates.
4. StudentRecordPostingGuard on completion commits.

Use established SCORM library or minimal RTE implementation; document supported versions.

Acceptance:
- [ ] Sample SCORM 1.2 package completes and records progress 100%
- [ ] INACTIVE student blocked from launch
```

---

## WP-8.3 — Peer review & essay AI grading queue

**Gap:** PEER_REVIEW enum; no allocation engine.

### Implementation prompt

```text
[AGENT B] Work package WP-8.3 only.

1. PeerReviewAllocationService — random assign N peers per submission after deadline.
2. Rubric grades from peers → median/average per institution setting.
3. AI essay grading: submit → BullMQ → draft feedback for faculty approve (human-in-the-loop).

Acceptance:
- [ ] 4 submissions → each reviewer gets 2 peers
- [ ] Faculty must approve AI feedback before release to student
```

---

## WP-8.4 — LMS frontend (quiz, continue learning, AI tutor panel)

**Gap:** Full quiz engine parity, course gradient branding.

### Implementation prompt

```text
[AGENT C] Work package WP-8.4 only.

Per Prompt 8.2: course cards with progress ring, continue learning deep link, collapsible AI tutor,
module tree sticky sidebar, assessment countdown timer, file upload assignments.

Acceptance:
- [ ] Student lands on last lesson from /lms dashboard Continue
- [ ] Quiz autosave + timer expiry submits attempt
```

---

# PHASE 9 — Finance

## WP-9.1 — Payment gateways production path

**Gap:** Default noop gateway; refunds need workflow.

### Implementation prompt

```text
[AGENT A] Work package WP-9.1 only.

1. Remove noop as production default — require explicit gateway in entity settings for charges.
2. Verify Stripe, Flutterwave, Paystack, Paymob webhooks with signature tests (invalid → 400).
3. Refund → WorkflowEngine FINANCE_REFUND → Finance Director approval.
4. Auto-charge on enrollment.created only if student ACTIVE.
5. Receipt PDF puppeteer + email.

Acceptance:
- [ ] Webhook replay attack rejected
- [ ] Refund without workflow returns 403
- [ ] finance-transaction-immutability audit passes
```

---

## WP-9.2 — Finance reports & scope

**Gap:** Dean/HoD scoped reports vs institution-wide.

### Implementation prompt

```text
[AGENT B] Work package WP-9.2 only.

Implement ReportsModule scope per Prompt 9.1:
- Finance Director: institution-wide; Dean: faculty OrgUnit subtree; HoD: department.
- Aging buckets 0-30, 31-60, 61-90, 90+; Excel + PDF export streaming.

Acceptance:
- [ ] HoD JWT cannot see other department revenue
```

---

# PHASE 10 — HR

## WP-10.1 — HR completeness (workload, 360 appraisal, org chart API)

### Implementation prompt

```text
[AGENT B + AGENT C] Work package WP-10.1 only.

1. Workload enforcement vs entity.settings.maxCreditHours — block or warn on assign.
2. Appraisal 360: collect peer feedback tokens; aggregate into appraisal record.
3. Leave calendar FullCalendar sync after approval.
4. /staff workload heatmap; leave calendar page.

Acceptance:
- [ ] Over-capacity lecturer assignment returns 409 with clear message
- [ ] 360 appraisal completes workflow HoD → Dean
```

---

# PHASE 11 — Elections & meetings

## WP-11.1 — Elections cryptographic audit

### Implementation prompt

```text
[AGENT A] Work package WP-11.1 only.

1. Verify voterHash = SHA-256(electionId + userId + institutionSecret) — no raw userId in vote row.
2. Security doc: docs/elections-security.md explaining anonymity + verification token.
3. Results certification workflow; admin-only live counts during voting.

Acceptance:
- [ ] Pen-test checklist elections section filled
- [ ] Double vote prevented by DB unique constraint (e2e)
```

---

## WP-11.2 — Meetings production features

### Implementation prompt

```text
[AGENT B + AGENT C] Work package WP-11.2 only.

1. Agenda drag-drop reorder; soft-delete agenda items (replace prisma.agendaItem.delete).
2. Zoom/Teams link via integration on schedule.
3. Resolution register searchable UI.
4. Action items with due reminders via NotificationService.

Acceptance:
- [ ] No hard delete in meetings service (soft delete only)
- [ ] generate-minutes → review → approve → PDF/DOCX export path complete
```

---

# PHASE 12 — Alumni & sports

## WP-12.1 — Alumni mentorship vectors & fundraising

### Implementation prompt

```text
[AGENT B] Work package WP-12.1 only.

1. POST /alumni/mentorship/suggest-matches — embed alumni + student vectors, cosine rank.
2. Events with paid registration → finance gateway.
3. Newsletter bulk send with entity-branded templates.
4. Alumni portal: jobs, events, profile completeness.

Acceptance:
- [ ] Suggestions return top 5 with scores; only staff with permission see student side
```

---

## WP-12.2 — Sports eligibility automation

### Implementation prompt

```text
[AGENT B] Work package WP-12.2 only.

1. BullMQ on grade.released → recalc all players in institution.
2. Block ineligible players from fixture lineup API.
3. AI alert digest to sports admin when ≥3 players on team below GPA threshold.

Acceptance:
- [ ] Grade publish triggers eligibility flip within 1 min
- [ ] Ineligible player rejected at lineup POST
```

---

# PHASE 13 — AI layer

## WP-13.1 — AI features completion

### Implementation prompt

```text
[AGENT A + AGENT B] Work package WP-13.1 only.

Implement missing Prompt 13.1 endpoints:
- POST /ai/content/summarize-lesson, generate-quiz, generate-rubric
- POST /ai/essay/feedback
- POST /ai/analytics/narrative/:institutionId(/:entityId)
- Student dropout risk batch job per entity
- PII stripper before external AI calls (names → Student A)
- Token usage daily limits per plan + ai_token_usage_total metric

Acceptance:
- [ ] PII audit: no raw studentNumber in OpenAI request bodies (unit test)
- [ ] Tutor cites lesson sources in SSE payload
```

---

## WP-13.2 — Intelligent timetabling engine

### Implementation prompt

```text
[AGENT A] Work package WP-13.2 only.

Replace stub assistant with constraint solver:
- Input: sections, rooms, faculty availability, constraints JSON.
- Output: 3 ranked schedules with clash score breakdown.
- Use OR-Tools or custom CSP; timeout 30s; BullMQ for large inputs.

Frontend /registrar/timetabling: show options, diff conflicts, apply selection → persist sections.

Acceptance:
- [ ] Generated schedule has zero room/faculty clashes
- [ ] Manual edit recalculates score
```

---

## WP-13.3 — AI mentorship matching (alumni)

### Implementation prompt

```text
[AGENT B] Work package WP-13.3 only.

Wire alumni mentorship embeddings to AiModule; shared EmbeddingsService; reindex job on profile update.

Acceptance:
- [ ] WP-12.1 suggest-matches uses same vectors as tutor RAG isolation
```

---

# PHASE 14 — Notifications & customization

## WP-14.1 — Firebase push & channel fallback

### Implementation prompt

```text
[AGENT B] Work package WP-14.1 only.

1. Firebase Admin SDK: send push on NotificationService dispatch when user has fcmTokens.
2. Channel fallback: push fail → email within same job.
3. Quiet hours: respect user timezone + preferences.quietHours (queue until window).
4. Emit all KEY EVENTS from Prompt 14.1 (status billing impact, grade released, fee due 7/3/1d…).

Acceptance:
- [ ] Integration test with Firebase mock records send attempt
- [ ] Quiet hours delay verified with frozen clock
```

---

## WP-14.2 — Custom forms conditional logic

### Implementation prompt

```text
[AGENT C] Work package WP-14.2 only.

Extend custom form builder:
- conditional_logic fields show/hide based on prior answers
- Analytics: response rate per field (admin chart)

Acceptance:
- [ ] Form with conditional branch validates only visible required fields
```

---

# PHASE 15 — Portals

## WP-15.1 — Portal parity & mobile readiness

### Implementation prompt

```text
[AGENT C] Work package WP-15.1 only.

1. Student /dashboard: all Prompt 15.1 widgets (schedule, due-soon, AI tip, announcements).
2. Guardian visibility flags from entity settings — hide finance/academic tabs when disabled.
3. Ensure all portal API calls use cursor pagination + ?fields= for mobile.

Acceptance:
- [ ] Guardian with finance disabled gets 403 on finance page
- [ ] Lighthouse mobile ≥ 85 on student dashboard
```

---

# PHASE 16 — Security & performance

## WP-16.1 — Security audit closure

### Implementation prompt

```text
[AGENT A + AGENT D] Work package WP-16.1 only.

1. Re-run all audits in apps/api/src/common/security/*.audit.spec.ts — fix violations.
2. Update security-findings-report.md — all CRITICAL/HIGH closed.
3. Complete docs/security/pen-test-checklist.md every checkbox with evidence links.
4. Grep enrollmentStatus writes — only StatusChangeService paths.
5. Presigned URL TTL 1h enforced in storage service.

Acceptance:
- [ ] pen-test-checklist 100% checked
- [ ] No open HIGH findings in report
```

---

## WP-16.2 — Performance & coverage gate

### Implementation prompt

```text
[AGENT D] Work package WP-16.2 only.

1. jest coverageThreshold 80% global in apps/api; fix gaps in billing, guards, progression.
2. EXPLAIN ANALYZE top 20 queries — add missing indexes (document in docs/performance-indexes.md).
3. Redis cache matrix from Prompt 16.2 — implement invalidation on settings update.
4. next bundle-analyzer on apps/web — dynamic import PDF/HLS/TipTap.
5. k6 smoke in CI optional job; p99 < 300ms on /students list.

Acceptance:
- [ ] pnpm test --coverage meets 80%
- [ ] CI fails if coverage drops below threshold
```

---

# PHASE 17 — DevOps & monitoring

## WP-17.1 — Kubernetes & ingress

### Implementation prompt

```text
[AGENT B] Work package WP-17.1 only.

Create k8s/:
- deployments + services api, web, admin; HPA; PDB; NetworkPolicy
- ingress nginx: *.unicore.io wildcard; annotations for entity subdomain → X-Entity-Code
- migration Job pre-install hook
- External Secrets Operator templates

Acceptance:
- [ ] helm template or kubectl apply --dry-run=client succeeds
- [ ] Document entity host routing in k8s/README.md
```

---

## WP-17.2 — Observability stack

### Implementation prompt

```text
[AGENT B] Work package WP-17.2 only.

1. Winston structured logging + correlationId middleware.
2. Prometheus /metrics endpoint: counters listed in Prompt 17.1.
3. Grafana dashboard JSON in ops/grafana/.
4. Sentry already in root — wire apps/api + apps/web DSN via env.
5. OpenTelemetry traces API → Prisma → Redis (optional collector in docker-compose).

Acceptance:
- [ ] /metrics exposes billing_snapshot_count
- [ ] Trace shows single request through DB and Redis
```

---

## WP-17.3 — CI/CD deploy & DR runbook

### Implementation prompt

```text
[AGENT B] Work package WP-17.3 only.

1. GitHub Actions deploy-staging.yml: build images → push ECR → deploy staging → health gate.
2. deploy-production.yml: on release tag, manual approval, rollback job.
3. docs/dr-runbook.md: backup, RTO/RPO, restore steps for Postgres + Redis + S3.

Acceptance:
- [ ] Staging deploy documented and repeatable
- [ ] DR drill checklist completed once in doc
```

---

# PHASE 18 — Integrations & public API

## WP-18.1 — Deep integrations (not catalog stubs)

### Implementation prompt

```text
[AGENT B] Work package WP-18.1 only.

For each integration in registry, implement real configure/test/disable:
- Zoom: create meeting for Section + Meeting (OAuth store encrypted).
- Google Calendar + Outlook: two-way sync jobs.
- Twilio SMS + WhatsApp: send test message in test().
- Turnitin: submit assignment API (sandbox).

Keep PaymentGatewayCatalogIntegration only for catalog display; finance module owns charges.

Acceptance:
- [ ] Zoom test() creates ephemeral meeting id
- [ ] Webhook delivery 5 retries with logged attempts
```

---

## WP-18.2 — GraphQL API (plan-gated)

### Implementation prompt

```text
[AGENT A] Work package WP-18.2 only.

Optional feature flag INSTITUTION_PLAN_PREMIUM:
- Apollo Server mounted at /graphql
- Resolvers for students, enrollments, grades (read), mutations behind same guards as REST
- Subscription for notification.created

Acceptance:
- [ ] GraphQL disabled when plan lacks feature
- [ ] Same entity isolation as REST (e2e)
```

---

## WP-18.3 — Migration importers (Banner, Canvas, Moodle)

### Implementation prompt

```text
[AGENT B] Work package WP-18.3 only.

apps/api/src/migrations-import/:
- CSV/JSON adapters for: students, courses, enrollments, grades (mapping UI in super-admin or institution settings).
- BullMQ zero-downtime batch with dry-run + row error report.
- No billing impact until explicit go-live flag.

Acceptance:
- [ ] Sample Banner export file imports 100 students with 0 errors
- [ ] Dry-run does not write DB
```

---

# PHASE 19 — Academic progression

## WP-19.1 — Progression release tests & UI completion

### Implementation prompt

```text
[AGENT B + AGENT C] Work package WP-19.1 only.

Read .cursorrules §15. Complete Prompt 19.1 §F tests as integration specs:

1. apps/api/test/progression-release.e2e-spec.ts — all checklist items automated.
2. /students/[id] — Progression panel: decisions, holds, repeat counters, next steps copy.
3. /registrar/progression — dry-run diff table, drill-down FULL_REPEAT and duration exceed.
4. Transcript carryover labels from CarryoverEnrollment.
5. Grep: no ProgressionDecision update/delete.

Acceptance:
- [ ] All §F checkboxes pass in CI
- [ ] Registrar batch dryRun shows student-level diff without writes
```

---

# CROSS-CUTTING — Final hardening (WP-X.\*)

## WP-X.1 — Soft delete enforcement

### Implementation prompt

```text
[AGENT D] Work package WP-X.1 only.

1. Grep apps/api for prisma\.\w+\.delete\( — replace with deletedAt updates except
   auth anonymisation flows documented in .cursorrules.
2. Add eslint rule or audit spec failing on new .delete( in src/.

Acceptance:
- [ ] audit spec passes; meetings agenda uses soft delete
```

---

## WP-X.2 — Universal cursor pagination

### Implementation prompt

```text
[AGENT E] Work package WP-X.2 only.

1. Audit all list endpoints — return { data, nextCursor, total }.
2. Use CursorPageQueryDto; default limit 25 max 100.

Acceptance:
- [ ] OpenAPI documents pagination on every GET list
```

---

## WP-X.3 — OpenAPI completeness

### Implementation prompt

```text
[AGENT E] Work package WP-X.3 only.

Every controller method: @ApiTags @ApiOperation @ApiResponse for 200/400/403/404.
Generate Postman collection in docs/postman/ from openapi.json export script.

Acceptance:
- [ ] pnpm openapi:export script produces valid spec
```

---

## WP-X.4 — Entity UI completeness

### Implementation prompt

```text
[AGENT C] Work package WP-X.4 only.

1. Entity badge on all institution-wide tables (students, staff, invoices).
2. Billable count in entity switcher (from GET /entities/stats).
3. Status timeline on every student profile tab header.

Acceptance:
- [ ] VC ALL-scope sees badge column on students list
```

---

## WP-X.5 — Final acceptance & documentation

### Implementation prompt

```text
[AGENT D] Work package WP-X.5 only.

1. Create docs/RELEASE_1.0_CHECKLIST.md — copy all acceptance boxes from this file into one checklist.
2. Run full CI locally: lint, typecheck, test, test:e2e, build, docker build all apps.
3. Update root README.md: architecture diagram, dev setup, links to master prompt and this doc.
4. Remove mock fallbacks from admin production paths.

Acceptance:
- [ ] RELEASE_1.0_CHECKLIST.md 100% checked
- [ ] Tag v1.0.0-ready in changelog
```

---

## Work package index (quick reference)

| ID      | Title                         |
| ------- | ----------------------------- |
| WP-0.1  | Turbo & Docker local parity   |
| WP-0.2  | CI with e2e                   |
| WP-0.3  | Dockerfiles                   |
| WP-0.4  | Schema audit                  |
| WP-1.1  | Prisma tenant middleware      |
| WP-1.2  | Entity scope guard            |
| WP-1.3  | Position & scope guards       |
| WP-1.4  | SAML SSO                      |
| WP-1.5  | Subdomain resolver & web auth |
| WP-1.6  | Affiliate API guard           |
| WP-2.1  | Entity provisioning parity    |
| WP-3.1  | Org chart UI                  |
| WP-4.1  | Workflow coverage audit       |
| WP-5.1  | Billing jobs reliability      |
| WP-6.1  | Super admin backend           |
| WP-6.2  | Super admin frontend          |
| WP-7.1  | SIS backend hardening         |
| WP-7.2  | SIS frontend polish           |
| WP-7.3  | Attendance offline PWA        |
| WP-7.4  | Documents verification        |
| WP-8.1  | HLS transcode                 |
| WP-8.2  | SCORM runtime                 |
| WP-8.3  | Peer review & essay AI        |
| WP-8.4  | LMS frontend parity           |
| WP-9.1  | Finance gateways production   |
| WP-9.2  | Finance scoped reports        |
| WP-10.1 | HR completeness               |
| WP-11.1 | Elections security audit      |
| WP-11.2 | Meetings production           |
| WP-12.1 | Alumni mentorship & events    |
| WP-12.2 | Sports eligibility automation |
| WP-13.1 | AI features completion        |
| WP-13.2 | Timetabling CSP engine        |
| WP-13.3 | AI mentorship vectors         |
| WP-14.1 | Firebase push & events        |
| WP-14.2 | Form conditional logic        |
| WP-15.1 | Portal parity                 |
| WP-16.1 | Security audit closure        |
| WP-16.2 | Performance & 80% coverage    |
| WP-17.1 | Kubernetes                    |
| WP-17.2 | Observability                 |
| WP-17.3 | Deploy & DR                   |
| WP-18.1 | Deep integrations             |
| WP-18.2 | GraphQL (optional)            |
| WP-18.3 | Migration importers           |
| WP-19.1 | Progression release tests     |
| WP-X.1  | Soft delete                   |
| WP-X.2  | Cursor pagination             |
| WP-X.3  | OpenAPI                       |
| WP-X.4  | Entity UI                     |
| WP-X.5  | Release 1.0 checklist         |

---

## Mandatory cross-cutting checklist (every WP)

Before marking any work package **done**, verify:

- [ ] `institutionId` + `entityId` on scoped models; no manual scope bypass without `@SkipInstitutionScope` + audit
- [ ] `StudentRecordPostingGuard` on all student-write endpoints in touched modules
- [ ] `enrollmentStatus` only via `StatusChangeService`
- [ ] `StatusChangeLog` / `ProgressionDecision` immutable (no UPDATE/DELETE)
- [ ] Mutations → `AuditLogService.log` with `entityId` + `billingImplication` when applicable
- [ ] Soft delete only (WP-X.1)
- [ ] DTO class-validator backend + matching zod on web forms touched
- [ ] Unit + integration tests for new behavior
- [ ] No secrets committed; `.env.example` updated

---

_This roadmap is the implementation companion to `UNICORE_MASTER_PROMPT.md`. When the master prompt and this doc diverge, master prompt + `.cursorrules` win._
