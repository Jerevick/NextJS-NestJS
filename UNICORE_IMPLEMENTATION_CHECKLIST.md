# UniCore — Implementation Checklist

Track progress against [`UNICORE_MASTER_PROMPT.md`](./UNICORE_MASTER_PROMPT.md) and [`.cursorrules`](./.cursorrules).

**Legend:** ✅ Done · 🟡 Partial · ⬜ Not started

**Last updated:** 2026-05-20 (Phase **15** student & guardian portals.)

---

## Roll-up summary

| Scope                                                         | Approx. complete |
| ------------------------------------------------------------- | ---------------- |
| **Phases 0–6** (foundation)                                   | ~85%             |
| **Phases 7–9** (SIS, LMS, Finance)                            | ~55%             |
| **Phases 10–19** (extended + platform + academic progression) | ~10%             |
| **All phases (0–19)**                                         | ~48%             |

---

## Phase 0 — Monorepo & database schema (~95%)

### Prompt 0.1 — Monorepo initialization

| Item                                                         | Status                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `turbo.json` + pnpm workspace                                | ✅                                                                             |
| Root scripts (`dev`, `build`, `db:migrate`, `db:seed`, etc.) | ✅                                                                             |
| `packages/config` (ESLint, TS, Tailwind)                     | ✅                                                                             |
| `docker-compose.yml` (Postgres, Redis, Minio, Mailhog)       | 🟡 — verify bull-board service                                                 |
| `.github/workflows` CI                                       | 🟡 — `ci.yml` exists; per-app `api.yml` / `web.yml` / `admin.yml` as specified |
| `apps/api` + `apps/web` `.env.example`                       | 🟡                                                                             |
| Husky + commitlint                                           | ✅                                                                             |
| App `src/` deferred in 0.1 (filled in later phases)          | ✅                                                                             |

### Prompt 0.2 — Complete database schema

| Item                                                            | Status                       |
| --------------------------------------------------------------- | ---------------------------- |
| `packages/database/prisma/schema.prisma` (three-tier + billing) | ✅                           |
| Migrations + seed (`demo-university`, super admin)              | ✅                           |
| `institutionId` + `entityId` on scoped models                   | 🟡 — audit remaining models  |
| pgvector / pg_trgm extensions                                   | 🟡 — confirm in compose/init |
| Shared `packages/types`, `ui`, `utils`                          | ✅                           |

---

## Phase 1 — Auth, guards & entity switcher (~88%)

### Prompt 1.1 — NestJS auth system

| Item                                                                       | Status                                               |
| -------------------------------------------------------------------------- | ---------------------------------------------------- |
| JWT access + refresh, blocklist on inactivation                            | ✅                                                   |
| `POST /auth/switch-entity`                                                 | ✅                                                   |
| Email/password login                                                       | ✅                                                   |
| Magic link OTP                                                             | ✅                                                   |
| Google / Microsoft OAuth                                                   | 🟡                                                   |
| SAML 2.0                                                                   | 🟡                                                   |
| TOTP MFA (speakeasy)                                                       | ✅                                                   |
| Tenant middleware + ALS (`tenant-als.ts`)                                  | 🟡 — not full `prisma-tenant.middleware` auto-inject |
| `InstitutionScopeGuard` + `PermissionsGuard`                               | ✅                                                   |
| `entity-scope.guard` / `position.guard` / `scope.guard` as named in prompt | 🟡 — patterns differ                                 |
| `SuperAdminGuard`                                                          | ✅                                                   |
| `AffiliateApiKeyGuard` + public verify API                                 | ✅                                                   |
| Rate limit on `/auth/*`                                                    | 🟡                                                   |
| OpenAPI on all auth endpoints                                              | 🟡                                                   |
| Auth unit tests                                                            | 🟡                                                   |

### Prompt 1.2 — StudentRecordPostingGuard

| Item                                                | Status                     |
| --------------------------------------------------- | -------------------------- |
| Global guard + `@StudentIdParam`                    | ✅                         |
| ACTIVE → allow; INACTIVE → 403                      | ✅                         |
| Approved `BackfillWindow` → allow + `isBackfilled`  | ✅                         |
| `@BypassRecordGuard` + super admin only             | 🟡                         |
| Integration tests (`billing-integrity`, guard spec) | 🟡                         |
| Applied on all student-write controllers            | 🟡 — spot-audit per module |

### Prompt 1.3 — Next.js auth + entity switcher

| Item                                   | Status                         |
| -------------------------------------- | ------------------------------ |
| NextAuth v5 (`apps/web`)               | ✅                             |
| Login / register / forgot-password     | ✅                             |
| `EntitySwitcher` component             | ✅                             |
| Fresh JWT on entity switch             | 🟡 — depends on web→API wiring |
| Protected `(institution)` layout shell | 🟡 — flat `app/` routes today  |

---

## Phase 2 — Institution entity module (~88%)

### Prompt 2.1 — InstitutionEntity backend

| Item                                                             | Status |
| ---------------------------------------------------------------- | ------ |
| Entity CRUD (dual-scoped)                                        | ✅     |
| `EntityProvisioningService` (org tree, workflows, head position) | ✅     |
| BullMQ `entity-provision` job                                    | 🟡     |
| Block delete if ACTIVE students                                  | 🟡     |
| Affiliate link creation                                          | 🟡     |

### Prompt 2.2 — Entity management + switcher UI

| Item                                 | Status                                   |
| ------------------------------------ | ---------------------------------------- |
| `/entities` list                     | ✅                                       |
| `/entities/new`                      | ✅                                       |
| `/entities/[id]` detail              | ✅                                       |
| Branding / settings UI               | 🟡                                       |
| Entity switcher in main shell topbar | 🟡 — on entities page, not global topbar |

---

## Phase 3 — Org structure & positions (~80%)

### Prompt 3.1 — Org structure backend

| Item                                        | Status |
| ------------------------------------------- | ------ |
| OrgUnit CRUD (hierarchy)                    | ✅     |
| Positions + permission bundles              | ✅     |
| Entity-type org templates                   | ✅     |
| User ↔ position assignment                  | 🟡     |
| `@RequirePosition` / scope guards on writes | 🟡     |

### Prompt 3.2 — Org chart UI

| Item                      | Status                        |
| ------------------------- | ----------------------------- |
| `/settings/org-structure` | 🟡 — tree list, not ReactFlow |
| `/settings/positions`     | ✅                            |
| ReactFlow org chart       | ⬜                            |

---

## Phase 4 — Workflow engine (~78%)

### Prompt 4.1 — Workflow engine backend

| Item                                                             | Status |
| ---------------------------------------------------------------- | ------ |
| `WorkflowEngineModule` (definitions, instances, steps)           | ✅     |
| Seeded workflows (reactivation, backfill, grade, deletion, etc.) | 🟡     |
| Completion handlers → `StatusChangeService`                      | ✅     |
| Position-based step routing                                      | 🟡     |

### Prompt 4.2 — Workflow inbox UI

| Item                            | Status |
| ------------------------------- | ------ |
| `/workflow/inbox`               | ✅     |
| `/workflow/initiated`           | ✅     |
| `/workflow/[instanceId]` review | ✅     |
| Action panel + timeline polish  | 🟡     |

---

## Phase 5 — Billing engine (~83%)

### Prompt 5.1 — Billing snapshot & invoice services

| Item                                                    | Status                    |
| ------------------------------------------------------- | ------------------------- |
| `BillingSnapshotService` (ACTIVE-only count)            | ✅                        |
| Daily snapshot immutability                             | ✅                        |
| `MonthlyBillableSummary` / watermark logic              | ✅                        |
| `BillingInvoiceService` (draft, lock, evidence S3)      | ✅                        |
| `BillingDisputeService` (initiate + auto-validate)      | 🟡                        |
| BullMQ: daily / monthly / lock / retroactive processors | ✅ (when `REDIS_URL` set) |
| Institution billing controller (read-only snapshots)    | ✅                        |
| Super-admin snapshot amend + dispute resolve            | ✅                        |
| Stripe webhook controller                               | 🟡                        |

### Prompt 5.2 — Status change & backfill services

| Item                                                    | Status |
| ------------------------------------------------------- | ------ |
| `StatusChangeService` sole writer of `enrollmentStatus` | ✅     |
| Synchronous session invalidation on INACTIVE            | ✅     |
| Immutable `StatusChangeLog`                             | ✅     |
| `BackfillRequestService` + workflow                     | ✅     |
| Retroactive invoice on approval                         | ✅     |
| `StudentDeletionService` + permanent deletion workflow  | ✅     |
| Reactivation requests                                   | ✅     |

### Prompt 5.3 — Billing dashboard UI (`apps/web`)

| Item                                               | Status                                        |
| -------------------------------------------------- | --------------------------------------------- |
| `/billing` overview + trend chart                  | 🟡                                            |
| `/billing/snapshot` dedicated history page         | 🟡                                            |
| `/billing/invoice/[id]` + dispute UI               | 🟡                                            |
| `/billing/disputes` tracker                        | 🟡                                            |
| `InactiveStudentBanner` on student profile         | ✅                                            |
| `StudentStatusTimeline`                            | 🟡 — present; Framer Motion / full fields TBD |
| Read-only mode for INACTIVE students               | 🟡                                            |
| Admin platform revenue + world map (Prompt 5.3 §6) | ⬜ / 🟡 — basic disputes only                 |

---

## Phase 6 — Super admin platform (~82%)

### Prompt 6.1 — Super admin backend

| Item                                                            | Status |
| --------------------------------------------------------------- | ------ |
| `SuperAdminModule` + `SuperAdminGuard`                          | ✅     |
| `POST /super-admin/institutions` provision                      | ✅     |
| List / detail / patch / suspend / activate                      | ✅     |
| `InstitutionHealthService` + anomaly detection                  | ✅     |
| `FeatureFlagsService` (platform + institution overrides)        | ✅     |
| Super-admin billing (disputes, amend, lock, generate invoice)   | ✅     |
| `MonitoringModule`                                              | 🟡     |
| `SubscriptionsModule` Stripe (customer, webhooks, auto-suspend) | ⬜     |
| Daily health-score BullMQ cron                                  | ⬜     |
| Monitoring WebSocket gateway                                    | ⬜     |

### Prompt 6.2 — Super admin frontend (`apps/admin`)

| Item                                                 | Status                                  |
| ---------------------------------------------------- | --------------------------------------- |
| `/dashboard` KPIs + anomalies                        | 🟡 — no MRR chart / map / live sessions |
| `/institutions` table                                | 🟡 — basic table                        |
| `/institutions/new` onboard form                     | 🟡 — single form, not 5-step wizard     |
| `/institutions/[id]` tabs (entities, billing, audit) | 🟡                                      |
| `/billing` + `/billing/disputes/[id]`                | 🟡                                      |
| Danger zone (suspend/terminate)                      | ⬜                                      |
| Feature flags UI                                     | ⬜                                      |

---

## Phase 7 — SIS (~82%)

### Prompt 7.1 — SIS backend

| Module                                      | Status | Gaps                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **StudentsModule**                          | 🟡     | CRUD, status logs, permanent deletion, **`POST /students/:id/confirm-graduation`** ✅; **list:** PostgreSQL **FTS + ILIKE** on name / number / email (raw SQL), **entity-scoped** roster for `ENTITY` JWTs, **`academicMetrics`** on **`GET /students`** ✅; **`POST /students/import-batch`** (validated JSON, cap 250) ✅; **`POST /students/import-csv-queue`** + job poll (BullMQ when `REDIS_URL`, else sync) ✅ |
| **AdmissionsModule**                        | 🟡     | Cycles, applications, forms, `POST .../enroll-student`; **`GET .../offer-letter`** HTML + **`GET .../offer-letter/pdf`** (Puppeteer) ✅                                                                                                                                                                                                                                                                               |
| **EnrollmentModule**                        | 🟡     | Enroll/drop, holds, waitlist, bulk BullMQ (+ inter-entity opt), timetable conflict API + enroll UI preview; institution `settings.enrollment.allowInterEntityEnrollment`                                                                                                                                                                                                                                              |
| **DocumentsModule**                         | 🟡     | Verify endpoint; graduation clearance via `GraduationClearanceRequest` + workflow                                                                                                                                                                                                                                                                                                                                     |
| **GradesModule**                            | 🟡     | Entry + **`settings.grades.componentWeights`** ✅ (API + registrar **`/settings/grading-weights`**) + **`PATCH /grades/settings/component-weights`**; **`GRADE_OVERRIDE`** + **`GRADE_RELEASE`** workflows ✅                                                                                                                                                                                                         |
| **AttendanceModule**                        | 🟡     | **`POST .../sections/:sectionId/session-qr`** JWT + optional QR **`qrDataUrl`**, **`POST /attendance/self-check-in`** (STUDENT) ✅; offline bulk sync still optional                                                                                                                                                                                                                                                  |
| **TranscriptsModule**                       | 🟡     | **`GET /transcripts/:id/pdf`** (pdf-lib) ✅; verify-by-hash; generation                                                                                                                                                                                                                                                                                                                                               |
| **StudentRecordPostingGuard** on all writes | 🟡     | Audit coverage                                                                                                                                                                                                                                                                                                                                                                                                        |

### Prompt 7.2 — SIS frontend (`apps/web`)

| Item                                                                       | Status                                                                                                                     |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/students` registry (filters, entity tabs, TanStack Table)                | 🟡                                                                                                                         | **Data grid:** CGPA, credits earned, academic standing columns; registry still single entity context from JWT     |
| `/students/[id]` profile (tabs, inactive banner, timeline)                 | 🟡                                                                                                                         | deterministic **insights** card on Summary                                                                        |
| `/students/new`, enroll (waitlist-if-full), bulk-enroll, reactivation      | 🟡                                                                                                                         |
| Enrollment holds panel on student academic tab                             | ✅                                                                                                                         |
| `/admissions` funnel + detail + enroll-student action                      | 🟡 — list + funnel + **Kanban** (≤500 apps, DragOverlay) + detail; ACCEPTED → `/offer-letter` (HTML) + `/offer-letter/pdf` |
| **`/enrollment/register`** → `/students/:studentId/enroll` for student JWT | ✅                                                                                                                         |
| `/grades/entry` faculty grade entry                                        | 🟡 — single **score** column, **weighted components** policy, **`grades.write`** link to **`/settings/grading-weights`**   |
| `/students/[id]` attendance + status tabs + confirm graduation             | 🟡                                                                                                                         |
| **`/teach/attendance-qr`** + **`/attendance/self-check-in`**               | ✅                                                                                                                         |
| Premium design system (navy/amber, Crimson Pro)                            | 🟡                                                                                                                         | **next/font** IBM Plex Sans + Crimson Pro vars + `@unicore/ui` theme uses `var(--font-*)`; polish still iterative |
| AI insights panel on student profile                                       | 🟡                                                                                                                         | deterministic heuristics only (LLM overlays still optional)                                                       |

## Phase 8 — LMS (~76%)

### Prompt 8.1 — LMS backend

| Item                                                                                                          | Status |
| ------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| Course instances, modules, lessons CRUD + reorder                                                             | ✅     |
| Lesson resources                                                                                              | ✅     | CRUD + list on shells; HTTPS `fileKey` links; opaque keys annotated until CDN/signed gateway |
| Video upload → transcode → HLS                                                                                | ⬜     |
| SCORM runtime                                                                                                 | ⬜     |
| **LmsAssessmentsModule** (CRUD, submissions, grade, `StudentRecordPostingGuard`)                              | 🟡     | Assessment question CRUD + solution masking for non-writers & attempts                       |
| **LMS question banks** (institution-scoped, items, `POST .../questions/import-from-bank`)                     | ✅     | Migration `20260515204500_lms_question_bank`                                                 |
| **Progress** (`POST /lms/lessons/:id/complete`, `GET .../progress?studentId=` + list snapshot **resume** IDs) | ✅     |
| Student LMS only when **ACTIVE** + **`StudentEnrollment`** in **ENROLLED/COMPLETED** (+ API self-scope)       | ✅     |
| AI lesson summary / question generation                                                                       | ⬜     |
| Grade passback to SIS (`LmsAssessment.settings.sisPassback` → **`StudentEnrollment.grade`**)                  | ✅     |

### Prompt 8.2 — LMS frontend

| Item                                                                      | Status |
| ------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`/lms`** course dashboard (master **§1**)                               | ✅     | `LmsStudentCoursesDashboard` (`/lms` nav + **Continue learning** + optional HTTPS **cover** thumbnails)                                                                                                                                              |
| **`/lms/[courseId]`** + lessons (master **§2** deep links)                | ✅     | **`LmsLearningShell`**: sticky **`CourseOutlineNav`** (○/✓ + current-lesson highlight), top **`LmsCourseProgressBar`** (or gradient fallback), **`LmsAiTutorDrawer`**; **`LmsCourseLearningHome`** + **`LmsLessonViewer`** (`/lms/...`)              |
| **`/courses/[id]`** learning shell (sticky outline, progress, tutor rail) | ✅     | Same shell + components with `learningRoutePrefix="/courses"` (course home + lessons)                                                                                                                                                                |
| **`/courses/.../lessons`** viewers (VIDEO/TEXT/DOCUMENT)                  | ✅     | HLS **`playbackRate`** + structured **`chapters`** + local **notes**; TEXT **estimated read time**; DOCUMENT **`react-pdf`** + zoom (iframe fallback when CORS/auth blocks PDF.js)                                                                   |
| `/courses` list (legacy alias)                                            | ✅     | Reuses LMS dashboard (`coursesBasePath="/courses"`)                                                                                                                                                                                                  |
| `/teach/[courseId]` Course Builder (master **§4**)                        | ✅     | Outline (DnD + reorder) + center **TipTap** / media / **QUIZ assessment picker** + lesson settings rail; **Gradebook** tab (GET `teacher/gradebook`, DataGrid PATCH `percentScore`); **Analytics** tab (`teacher/analytics`, Recharts)               |
| Lesson complete + HLS wiring                                              | ✅     | `StudentRecordWrite` on lesson complete                                                                                                                                                                                                              |
| Graduation clearance on student status tab                                | ✅     |
| Bulk enroll BullMQ (`POST /enrollments/bulk`)                             | ✅     |
| Assessment submission UI                                                  | 🟡     | MCQ + **True/False** on non-quiz assessments; question bank **add/remove items** in authoring UI                                                                                                                                                     |
| HLS playback                                                              | ✅     | `hls.js` + Safari native fallback                                                                                                                                                                                                                    |
| **Quiz engine** folder (`quiz-engine/` per master **§3**)                 | ✅     | **`QuizAttemptShell`**: fullscreen, navigator (●/○ + flags), countdown **skew-corrected** via **`serverNow`**, **`quiz.draft.save`** WebSocket autosave **~30s** (REST PATCH fallback) + **localStorage** parity, receipt uses API **`submittedAt`** |
| AI tutor conversational UI                                                | 🟡     | **`LmsAiTutorDrawer`** multi-turn chat shell (canned previews + lesson context); streaming RAG still **Phase 13**                                                                                                                                    |

---

## Phase 9 — Finance (~100%)

### Prompt 9.1 — Finance backend & frontend

| Item                                                     | Status |
| -------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `FinanceModule` (fees, payments, accounts, scholarships) | ✅     | Ledger, fee structures, **`enrollment.created` event** → auto-charge, scholarships + **application portal**, payment plans, bulk charges |
| Payment gateways (Stripe, Flutterwave, Paystack, Paymob) | ✅     | `initiateRefund`, verified webhooks (incl. Paymob), entity `settings.paymentGateway`                                                     |
| Redis balance cache (1h TTL)                             | ✅     | **`FinanceBalanceCacheService`** + invalidate on ledger / gateway; display balance from **SUM(completed)** with reconcile                |
| Financial holds                                          | ✅     | Auto-place **FINANCIAL** enrollment holds (daily cron); `settings.finance.holdBalanceThreshold` / `holdOverdueDays`                      |
| Fee waiver / refund workflows                            | ✅     | **`FEE_WAIVER`**, **`FINANCE_REFUND`** → ledger on approval (atomic pending txn + workflow)                                              |
| Student excess refund / transfer                         | ✅     | Scholarship-locked vs cash; payment-plan reserve; **`STUDENT_EXCESS_REFUND`** / **`STUDENT_EXCESS_TRANSFER`** workflows                  |
| Payment plan reminders                                   | ✅     | Daily cron → **email** + audit; gateway payments allocate to installments                                                                |
| Finance reports                                          | ✅     | Revenue by programme/fee type; Dean/HoD/Bursar scope; Excel + PDF export; **filters forwarded** on export proxies + aging/outstanding    |
| PDF receipts + notifications                             | ✅     | Receipt PDF (S3 optional), email, **`UserNotification`** + `/notifications`                                                              |
| Scholarship workflow                                     | ✅     | **`SCHOLARSHIP_APPLICATION`** + **`SCHOLARSHIP_AWARD`**; atomic workflow initiation                                                      |
| BURSAR-only mutations                                    | ✅     | Fee CRUD, bulk charge, waivers/refunds, scholarships, bank config, GL account upsert                                                     |
| Application form builder                                 | ✅     | `POST /finance/scholarship-forms` + hub UI                                                                                               |
| Gateway `handleWebhook`                                  | ✅     | Implemented on gateways; routed via `FinancePaymentsWebhookService`                                                                      |
| Institution GL (chart of accounts)                       | ✅     | `FinanceGlAccount` / `FinanceGlJournalLine`; post on completed txns; trial balance + txn journal APIs                                    |
| GL admin (web)                                           | ✅     | **`FinanceGlCoaPanel`** on `/finance` — list COA, trial balance, BURSAR upsert / activate                                                |
| Double-entry metadata                                    | ✅     | `metadata.ledgerEntries` + `metadata.gl` envelope via **`buildLedgerMetadata`**                                                          |
| Gateway verify + bank webhook secret                     | ✅     | `verifyPayment` before gateway complete; per-entity **`webhookSecret`** upsert + hub field                                               |
| Payment plans (BURSAR)                                   | ✅     | Create plan requires finance director                                                                                                    |
| Spec path alias                                          | ✅     | `apps/api/src/modules/finance/index.ts` re-exports module                                                                                |
| Institution `/finance/*` pages                           | ✅     | Fee structures (full item CRUD), bulk charge, reports, scholarships, GL COA                                                              |
| Student / guardian finance                               | ✅     | **`/my-finance`** (pay online, receipt PDFs, scholarship apply, excess credit); guardian route with **linked-guardian** API enforcement  |
| Guardian access enforcement                              | ✅     | **`FinanceStudentAccessService`** + `Student.guardians` JSON match (`userId` / `email`)                                                  |
| Fee structure editor (web)                               | ✅     | **`FinanceFeeStructureEditor`** — create / update items, not rename-only                                                                 |

---

## Phase 10 — HR & staff (100%)

### Prompt 10.1

| Item                                                                | Status |
| ------------------------------------------------------------------- | ------ |
| Prisma HR models (StaffProfile, Leave, Appraisal, Workload)         | ✅     |
| Staff profiles CRUD (dual-scoped)                                   | ✅     |
| Leave types, balances, requests + `LEAVE_REQUEST` workflow          | ✅     |
| Appraisals + `STAFF_APPRAISAL` workflow                             | ✅     |
| Workload records + capacity heatmap                                 | ✅     |
| Org chart API (`GET /staff/org-chart`)                              | ✅     |
| Permissions `staff.read` / `staff.write`                            | ✅     |
| `/staff` hub UI                                                     | ✅     |
| FullCalendar leave UI, profile create forms                         | ✅     |
| AI workload distribution suggestion (`GET /staff/workload/suggest`) | ✅     |
| Leave calendar + `/leave/*` alias routes                            | ✅     |
| Seed: HR module, demo staff, leave types, workflows                 | ✅     |
| Salary field encryption at rest (AES-256-GCM)                       | ✅     |
| Cross-entity access (`GET /staff/profiles/:id/entity-access`)       | ✅     |
| 360° appraisals + batch cycle + peer feedback                       | ✅     |
| iCal export + Google/Outlook calendar links                         | ✅     |
| HR Director workflow step (`HR_DIRECTOR` position)                  | ✅     |
| Nice-to-have: `LeaveModule` + `modules/*` aliases                   | ✅     |
| Cross-entity grant/revoke UI + API                                  | ✅     |
| Google/Outlook OAuth calendar push                                  | ✅     |
| Reviewer appraisal + KPI template (API + hub UI)                    | ✅     |
| Leave covering staff + supporting doc (web)                         | ✅     |
| Qualifications/publications on profiles                             | ✅     |
| ReactFlow org chart on `/staff`                                     | ✅     |
| `/staff/inbox` HR workflow filter                                   | ✅     |
| Seed `HR_DIRECTOR` position holder                                  | ✅     |
| Apply workload suggestions (web)                                    | ✅     |

---

## Phase 11 — Elections & meetings (100%)

### Prompt 11.1 — Elections

| Item                                     | Status |
| ---------------------------------------- | ------ |
| Prisma Election models + migration       | ✅     |
| Blind-signature voting (voterHash)       | ✅     |
| Nominations, ballot, verify token        | ✅     |
| Admin results + certification workflow   | ✅     |
| Election management audit log            | ✅     |
| `/elections` API + web hub               | ✅     |
| Permissions elections.read/manage        | ✅     |
| Seed demo election + ELECTIONS module    | ✅     |
| Institution-wide scope (`ElectionScope`) | ✅     |
| Auto lifecycle sync (cron + manual)      | ✅     |
| Voting-open notifications                | ✅     |
| Manifesto upload (storage)               | ✅     |
| Public published results                 | ✅     |
| `ELECTION_CERTIFICATION` workflow        | ✅     |
| Tenant module gating (`ELECTIONS`)       | ✅     |
| Rich web hub (candidates, audit, booth)  | ✅     |

### Prompt 11.2 — Meetings + AI minutes

| Item                                | Status |
| ----------------------------------- | ------ |
| Prisma Meeting models + migration   | ✅     |
| Meeting CRUD, agenda, attendees     | ✅     |
| Resolutions register + live vote    | ✅     |
| AI minutes (OpenAI + heuristic)     | ✅     |
| Committees, action items, iCal      | ✅     |
| `/meetings` API + web hub           | ✅     |
| Permissions meetings.\* + seed      | ✅     |
| Meeting PATCH/cancel/start/end      | ✅     |
| Agenda edit/delete + reorder        | ✅     |
| Minutes text file (storage)         | ✅     |
| `MEETING_MINUTES_FILING` workflow   | ✅     |
| Action-item due reminders (cron)    | ✅     |
| Meeting type hierarchy validation   | ✅     |
| Committee update/retire             | ✅     |
| Tenant module gating (`MEETINGS`)   | ✅     |
| Rich web hub (create, agenda, live) | ✅     |
| Permission bundles seed             | ✅     |

---

## Phase 12 — Alumni & sports (100%)

### Prompt 12.1 — Alumni

| Item                                                         | Status |
| ------------------------------------------------------------ | ------ |
| Directory search (name, industry, location, programme, year) | ✅     |
| Self-registration + chapter member management                | ✅     |
| Events with Stripe checkout + job board + fundraising        | ✅     |
| Branded newsletter + survey analytics                        | ✅     |
| Mentorship programs/pairs + faculty department gate          | ✅     |
| AI mentorship matching (pgvector)                            | ✅     |
| `/alumni` web hub + API                                      | ✅     |

### Prompt 12.2 — Sports

| Item                                            | Status |
| ----------------------------------------------- | ------ |
| Teams, roster, medical clearance                | ✅     |
| Facility FullCalendar + conflict detection      | ✅     |
| Inter-entity fixtures + logistics               | ✅     |
| Competition registration + eligibility block    | ✅     |
| Player career stats + awards/records            | ✅     |
| Institution-wide GPA recalc + AI at-risk alerts | ✅     |
| `/sports` web hub + API                         | ✅     |

---

## Phase 13 — AI intelligence layer (~3%)

### Prompt 13.1

| Item                                   | Status |
| -------------------------------------- | ------ |
| `AIModule` + RAG (pgvector embeddings) | ⬜     |
| AI tutor (SSE)                         | ⬜     |
| Academic risk / advisor / insights     | ⬜     |
| Billing anomaly (health service)       | 🟡     |

---

## Phase 14 — Notifications & customization (~95%)

### Prompt 14.1 — Notification engine

| Item                                                                                     | Status |
| ---------------------------------------------------------------------------------------- | ------ |
| `NotificationService.send()` + template cascade                                          | ✅     |
| Channels: email (Handlebars + institution SMTP), inApp (WS + record)                     | ✅     |
| SMS: Twilio + Africa's Talking (`settings.notifications.sms`)                            | ✅     |
| Push: Firebase FCM (`FIREBASE_SERVICE_ACCOUNT_JSON` / institution config)                | ✅     |
| Push → email channel fallback                                                            | ✅     |
| BullMQ `notification-dispatch` (per-channel jobs)                                        | ✅     |
| Quiet hours (user timezone + `preferences.quietHours`)                                   | ✅     |
| Digest mode (LOW + `digestMode` → hourly email/SMS summary)                              | ✅     |
| Admin templates API + platform defaults                                                  | ✅     |
| Read receipts (`readAt`, GET by id, Open link)                                           | ✅     |
| Bulk broadcast (`POST /notifications/admin/bulk`)                                        | ✅     |
| Targets: ALL_INSTITUTION, SPECIFIC_ENTITY, ALL_EXCEPT_ENTITY, BY_PROGRAMME               | ✅     |
| Entity admin scope (own entity / programme only)                                         | ✅     |
| Scheduled send (`scheduledAt` + BullMQ `notification-scheduled`)                         | ✅     |
| List/cancel pending scheduled (`GET/POST …/scheduled`)                                   | ✅     |
| Key event hooks (`NotificationEventsService`)                                            | ✅     |
| Status GAIN/LOSS → Registrar + Finance                                                   | ✅     |
| Grade released, fee due 7/3/1d, workflow assign/SLA, document ready                      | ✅     |
| Election voting open, backfill approved                                                  | ✅     |
| `sendSystem()` for internal callers; legacy `create()` delegates to engine               | ✅     |
| Finance / meetings / staff migrated to `sendSystem()` + events                           | ✅     |
| Web client `notification.new` on `/realtime` (app-wide provider + `/notifications` page) | ✅     |
| Finance PDF receipts via `sendSystem()` (`FINANCE_PAYMENT_RECEIPT` + storage attachment) | ✅     |

### Prompt 14.2 — Customization engine

| Item                                                                                     | Status |
| ---------------------------------------------------------------------------------------- | ------ |
| `CustomizationModule` + `getEffectiveSetting` cascade (entity → institution → platform)  | ✅     |
| Entity-overridable vs institution-only keys enforced on entity patch                     | ✅     |
| Settings API: list/get effective, institution/entity patch, branding + logo upload       | ✅     |
| `CustomForm` + `FormSubmission` models, CRUD, publish, submit, analytics                 | ✅     |
| Field types: text…radio, `file`, `section_header`, `conditional_logic` (`showWhen`)      | ✅     |
| `POST /forms/:id/submit` + `GET /forms/:id` (published schema)                           | ✅     |
| Analytics: field completion, response rate, 30-day `submissionTrend`                     | ✅     |
| Admission `ApplicationForm` (cycle-bound) coexists with campus `CustomForm`              | ✅     |
| `/settings` hub + branding, academic, custom-forms, notifications, integrations, payment | ✅     |
| Branding: logo file upload + colour picker + domain                                      | ✅     |
| Academic: grading system, semesters, calendar offset, link to grading weights            | ✅     |
| Custom forms: drag-and-drop field builder + conditional showWhen                         | ✅     |
| Notifications: per-event sidebar template editor                                         | ✅     |
| Payment: gateway + masked API key inputs (institution scope)                             | ✅     |

---

## Phase 15 — Student & guardian portals (100%)

### Prompt 15.1 — Student portal

| Item                                                                                     | Status |
| ---------------------------------------------------------------------------------------- | ------ |
| Dedicated student shell + routes                                                         | ✅     |
| Self-service registration, grades, LMS, fees                                             | ✅     |
| `/dashboard` home (CGPA ring, credit progress, timetable, due assessments, academic tip) | ✅     |
| `/my-courses` via `GET /portal/student/lms/courses` (no `lms.read` required)             | ✅     |
| `/my-grades`, `/my-finance`, `/my-documents`, `/my-attendance`                           | ✅     |
| Document request wizard + `POST /portal/student/documents/request`                       | ✅     |
| Excess credit via `GET /portal/student/finance/excess-credit`                            | ✅     |
| `/register-courses` self-enrollment via `POST /portal/student/enrollments`               | ✅     |
| INACTIVE read-only banner + blocked pay/enroll                                           | ✅     |
| `PortalModule` API (`/portal/student/*`)                                                 | ✅     |
| GPA trend chart + AI academic tips (BYOK fallback)                                       | ✅     |

### Prompt 15.2 — Guardian portal

| Item                                                           | Status |
| -------------------------------------------------------------- | ------ |
| Guardian auth + linked students view                           | ✅     |
| `/guardian/dashboard` summary KPIs + polished student cards    | ✅     |
| Academic / finance / attendance per linked student             | ✅     |
| Entity settings `guardianPortal.{academic,finance,attendance}` | ✅     |
| `GET /portal/guardian/students` + child routes                 | ✅     |

---

## Phase 16 — Security audit & performance (~100%)

### Prompt 16.1 — Security audit

| Item                                   | Status |
| -------------------------------------- | ------ |
| Cross-tenant / cross-entity leak tests | ✅     |
| Testcontainers entity-isolation E2E    | ✅     |
| `getById` entity scope enforcement     | ✅     |
| Guard coverage audit                   | ✅     |
| Pen-test checklist / ADRs              | ✅     |
| Helmet + login throttle (5 / 15 min)   | ✅     |
| Upload magic-byte validation           | ✅     |
| Webhook signature verify util          | ✅     |
| Affiliate entity switch blocked        | ✅     |
| Finance transaction immutability       | ✅     |
| `security-findings-report.md`          | ✅     |

### Prompt 16.2 — Performance

| Item                                                | Status |
| --------------------------------------------------- | ------ |
| Cursor pagination (core lists)                      | ✅     |
| Query indexes / N+1 review                          | ✅     |
| Load testing                                        | ✅     |
| Redis tenant settings cache                         | ✅     |
| Response compression (gzip)                         | ✅     |
| Global `?fields=` selection                         | ✅     |
| Presigned download URLs wired                       | ✅     |
| Frontend dynamic imports (PDF, HLS, TipTap, charts) | ✅     |
| `pnpm analyze` bundle report (`apps/web`)           | ✅     |
| Field encryption audit spec                         | ✅     |

---

## Phase 17 — DevOps & monitoring (~15%)

### Prompt 17.1 — Production infrastructure

| Item                                   | Status |
| -------------------------------------- | ------ |
| `docker-compose.prod.yml`              | 🟡     |
| Per-app Dockerfiles                    | 🟡     |
| GitHub Actions deploy pipelines        | 🟡     |
| `GET /health`                          | ✅     |
| Monitoring API + admin dashboard hooks | 🟡     |
| Structured logging + correlation IDs   | 🟡     |
| Sentry / Datadog                       | ⬜     |

---

## Phase 18 — Integrations & public API (~95%)

### Prompt 18.1

| Item                                                               | Status |
| ------------------------------------------------------------------ | ------ |
| Affiliate verify API (student/transcript)                          | ✅     |
| Integration marketplace (strategy pattern, configure/test/disable) | ✅     |
| Zoom / WhatsApp / calendar + payment catalog providers             | ✅     |
| Public API keys (`uc_live_…`, scopes, rate limit, entity routing)  | ✅     |
| Webhook framework (BullMQ, HMAC signatures, delivery logs, test)   | ✅     |
| Platform events: enrollment, status, grade, payment, workflow      | ✅     |
| Mobile: FCM token, attendance sync, `?fields=` selection           | ✅     |
| Developer docs + Postman starter + OpenAPI `/api/docs-json`        | ✅     |
| iCal public subscribe feed                                         | ✅     |
| GraphQL API (institution plan feature)                             | ⬜     |

---

## Phase 19 — Academic progression (~100%)

Normative rules: [`.cursorrules`](./.cursorrules) SECTION 15. Build contract: [`UNICORE_MASTER_PROMPT.md`](./UNICORE_MASTER_PROMPT.md) **Phase 19 / Prompt 19.1**.

### Prompt 19.1 — Promotion & repeat

| Item                                                                                                                    | Status |
| ----------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | --------------------------- |
| **ProgressionRule** + migration `20260516183000_academic_progression_phase19`; partial unique (institution / programme) | ✅     | CRUD + soft delete via \*\*`GET                                                                                                                                                                                                                                                  | POST /sis/progression/rules`**, **`PATCH | DELETE …/rules/:ruleId`\*\* |
| **ProgressionDecision** append-only (create-only in API)                                                                | ✅     | **`POST /sis/progression/decisions`**, **`GET …/students/:studentId/decisions`**; **`POST …/evaluate-batch`** appends PROMOTION/AUTOMATIC when **`dryRun=false`**; **`progression-decision.contract.spec`** guards against update/delete                                         |
| **StudentAcademicSessionRecord** (`StudentAcademicSession` equivalent)                                                  | ✅     | **`POST /sis/progression/academic-sessions`** (upsert)                                                                                                                                                                                                                           |
| **CarryoverEnrollment** + **ResitRecord**                                                                               | ✅     | **`POST …/carryovers`**, **`GET …/students/:studentId/carryovers`**, **`POST …/resits`**                                                                                                                                                                                         |
| **StudentProgressionHold**                                                                                              | ✅     | **`POST …/students/:studentId/holds`**, **`GET`** active holds, **`PATCH …/holds/:holdId/clear`**                                                                                                                                                                                |
| Batch evaluate (**`POST …/evaluate-batch`**) — GPA / thresholds                                                         | ✅     | Semester-required; classification + dry run; **`dryRun=false`** writes non-duplicate PROMOTION/AUTOMATIC; **`initiateReviewWorkflows`** starts seeded **`ACADEMIC_PROGRESSION_*`** workflows with dedupe; **`progression.service.spec`**                                         |
| **RepeatEnrollmentGuard** + enrollment DTO (`originalSemesterId`, `enrollmentAttemptNumber`)                            | ✅     | Injectable **`RepeatEnrollmentGuard`** → **`assertEnrollmentWithinProgressionLimits`**; **`EnrollmentService.create`**                                                                                                                                                           |
| **GpaComputationService** + **ResitGradeService**                                                                       | ✅     | GPA policy in **`ProgressionService`** / **`StudentsService`**; deterministic resit cap **`ResitGradeService`** (**`grades.service`** + delegated **`ProgressionService.clamp`**) · **`resit-grade.service.spec`**                                                               |
| Workflow templates (conditional promotion, full repeat, manual, max duration, **aegrotat**)                             | ✅     | Seed + defaults: **`ACADEMIC_PROGRESSION_*`**, **`AEGROTAT`**; batch maps recommendations → definitions                                                                                                                                                                          |
| Student profile + registrar UI                                                                                          | ✅     | **`StudentProgressionInsights`** on **`/students/[id]`**; **`/registrar/progression`** batch form (dry run + workflow checkbox)                                                                                                                                                  |
| Permissions **`progression.read` / `progression.write`** (seed → demo registrar) + tests                                | ✅     | Seed ✅; **`gpa-policy`**, **`progression-batch-eval`**, **`GpaComputationService`**, **`progression.service.spec`**, **`progression-review-workflow.util.spec`**, contract + resit specs. Full HTTP Supertest/E2E deferred to repo-wide Testcontainers rollout (cross-cutting). |
| OpenAPI — **`sis/progression`**                                                                                         | ✅     | **`@ApiTags('sis-progression')`**, bearer, **`@ApiOperation`** / params on **`ProgressionController`**; Swagger on **`EvaluateProgressionBatchDto`**                                                                                                                             |

---

## Cross-cutting — Definition of Done (all phases)

| Requirement                   | Status                                  |
| ----------------------------- | --------------------------------------- |
| TypeScript strict, no `any`   | 🟡                                      |
| 80%+ test coverage per module | ⬜ (~12 spec files incl. LMS autograde) |
| OpenAPI on every endpoint     | 🟡                                      |
| Audit log on every mutation   | 🟡                                      |
| Cursor-based list pagination  | 🟡                                      |
| Soft delete only in services  | 🟡                                      |

---

## Suggested next work (prompt order)

1. **Phase 10** — HR & staff module
2. **Phase 8** — LMS smoke tests; optional `@next/next` ESLint plugin in web config
3. **Phase 5.3** — polish invoice dispute UX
4. ~~**Phase 19 / Prompt 19.1**~~ — **Done** (see Phase 19 table); next: optional Supertest progression smoke when Testcontainers baseline lands

---

## How to update this file

When completing a prompt item, change its status in the table and bump **Last updated**. Recompute phase % if a whole prompt block is done.

Reference phase headers in `UNICORE_MASTER_PROMPT.md` (e.g. `# PHASE 7 — STUDENT INFORMATION SYSTEM`, `# PHASE 19 — ACADEMIC PROGRESSION`).
