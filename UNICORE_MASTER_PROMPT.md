# 🎓 UniCore SaaS — Master Implementation Prompt

## The Single Source of Truth for Building UniCore

### Version 5.0 — Definitive & Comprehensive

---

> **Project**: UniCore — University SIS + LMS SaaS Platform
> **Stack**: NestJS · Next.js 15 · PostgreSQL 16 · Prisma 5 · Redis · BullMQ · S3 · pgvector · Socket.io · OpenAI/Anthropic
> **Architecture**: Multi-tenant · Three-Tier Model (Institution → Entity → OrgUnit) · Hierarchical RBAC · Workflow Engine · Status-Based Billing
> **Companion File**: `.cursorrules` — read it before every prompt. It contains all laws, standards, and rules.

---

## 📖 HOW TO USE THIS DOCUMENT

1. **Read `.cursorrules` first** — it is the law. Every prompt assumes you know it.
2. **Open a new Cursor chat per prompt** — do not chain unrelated prompts.
3. **Use the agent specified** — `[AGENT A]` through `[AGENT E]` as labelled.
4. **Tag this file** with `@UNICORE_MASTER_PROMPT.md` in Cursor chat when cross-referencing.
5. **Follow the sequence** — each phase builds on the previous. Do not skip.
6. **The checklist at the bottom of each prompt** is your acceptance criteria.

---

## 🗺️ SYSTEM MAP

```
┌──────────────────────────────────────────────────────────────────────┐
│                        UNICORE SAAS PLATFORM                         │
├─────────────────────────┬────────────────────────────────────────────┤
│   SUPER ADMIN LAYER     │         INSTITUTION LAYER                  │
│   (UniCore Staff)       │  (University — multi-entity)               │
│                         │                                            │
│  • Subscription Mgmt    │  TIER 2: InstitutionEntity                │
│  • Per-Student Billing  │    Main Campus, Extramural, School,        │
│  • Usage Monitoring     │    Distance Learning, Affiliate, etc.      │
│  • Tenant Provisioning  │                                            │
│  • Feature Flags        │  TIER 3: OrgUnit (within each entity)     │
│  • Billing Disputes     │    Faculty → Dept → Programme             │
│  • Health Dashboard     │    Admin Units, Committees                 │
│                         │                                            │
│                         │  MODULES:                                  │
│                         │    SIS:     Admissions, Students,          │
│                         │             Enrollment, Grades,            │
│                         │             Attendance, Documents          │
│                         │    LMS:     Courses, Assessments,          │
│                         │             Progress, AI Tutor             │
│                         │    Finance: Fees, Payments, Scholarships   │
│                         │    HR:      Staff, Leave, Appraisals       │
│                         │    Other:   Elections, Meetings, Alumni,   │
│                         │             Sports, Analytics              │
└─────────────────────────┴────────────────────────────────────────────┘
```

---

## 🤖 AGENT QUICK REFERENCE

| Agent         | Model           | Speciality                                                               |
| ------------- | --------------- | ------------------------------------------------------------------------ |
| **[AGENT A]** | Claude Opus 4   | Architecture, schema design, security, billing logic, complex algorithms |
| **[AGENT B]** | Claude Sonnet 4 | NestJS modules, services, BullMQ, integrations, React+business logic     |
| **[AGENT C]** | GPT-4o          | Next.js pages, shadcn/ui, dashboards, form wizards, animations           |
| **[AGENT D]** | Gemini 1.5 Pro  | Code review, consistency audits, refactoring, documentation              |
| **[AGENT E]** | Cursor Tab      | DTO completion, test fill-in, OpenAPI decorators, boilerplate            |

**Agent prefix** — paste at the top of every Cursor chat:

```
You are a senior full-stack engineer building UniCore, an enterprise
university SIS+LMS SaaS. Read .cursorrules at the monorepo root for all
laws, standards, and architectural decisions. Never violate those laws.
Write production-grade code only. No placeholders. No TODOs.
```

---

## 📦 COMPLETE TOOLS & LIBRARIES REFERENCE

### Backend (apps/api)

```
NestJS Core:   @nestjs/core @nestjs/common @nestjs/platform-express @nestjs/config
               @nestjs/swagger @nestjs/event-emitter @nestjs/schedule
               @nestjs/throttler @nestjs/cache-manager @nestjs/websockets

Auth:          @nestjs/passport @nestjs/jwt passport passport-jwt
               passport-google-oauth20 passport-azure-ad passport-saml
               speakeasy (TOTP/MFA) qrcode bcrypt

Database:      @prisma/client prisma ioredis bullmq @nestjs/bullmq

AI & Search:   openai @anthropic-ai/sdk langchain @langchain/community pgvector

Files:         @aws-sdk/client-s3 @aws-sdk/s3-request-presigner multer
               sharp (image processing) puppeteer (PDF generation)
               archiver csv-parser fast-csv exceljs

Communication: nodemailer handlebars twilio firebase-admin @slack/web-api

Payments:      stripe flutterwave-node-v3 paystack-node (Paymob via REST)

Security:      helmet compression @nestjs/throttler

Testing:       jest @nestjs/testing supertest @testcontainers/postgresql faker

Utilities:     date-fns nanoid winston uuid zod dayjs class-validator
               class-transformer
```

### Frontend (apps/web + apps/admin)

```
Core:          next@15 react@19 react-dom@19 typescript tailwindcss

UI:            @shadcn/ui lucide-react @radix-ui/* framer-motion
               tailwind-merge clsx class-variance-authority

Data:          @tanstack/react-query@5 @tanstack/react-table@8
               @tanstack/react-virtual@3 zustand immer

Forms:         react-hook-form zod @hookform/resolvers

Charts & Viz:  recharts d3 react-simple-maps (admin world map)
               @xyflow/react (org charts, workflow builder)
               @fullcalendar/react @fullcalendar/daygrid
               @fullcalendar/timegrid @fullcalendar/interaction
               leaflet react-leaflet (campus maps)

Content:       @tiptap/react @tiptap/pm @tiptap/starter-kit
               react-pdf hls.js react-dropzone

QR:            qrcode.react html5-qrcode (attendance scanner)

Auth:          next-auth@5

Utilities:     axios date-fns numeral sonner @dnd-kit/core @dnd-kit/sortable
```

---

## ⚡ IMPLEMENTATION SEQUENCE

Execute phases in this exact order. Each depends on the previous.

```
FOUNDATION (Weeks 1–4)
  Phase 0:  Monorepo + DB Schema
  Phase 1:  Auth + Entity Switcher + StudentRecordPostingGuard
  Phase 2:  InstitutionEntity Module
  Phase 3:  Org Structure + Positions
  Phase 4:  Workflow Engine
  Phase 5:  Billing Engine (snapshot + invoice + status change + backfill)
  Phase 6:  Super Admin (platform management)

CORE MODULES (Weeks 5–10)
  Phase 7:  SIS — Admissions + Students + Enrollment + Grades + Attendance + Documents
  Phase 8:  LMS — Course Builder + Assessments + Progress + AI Tutor
  Phase 9:  Finance — Fees + Payments + Accounts + Scholarships

EXTENDED MODULES (Weeks 11–14)
  Phase 10: HR — Staff + Leave + Appraisals + Workload
  Phase 11: Elections (blind voting) + Meetings (AI minutes)
  Phase 12: Alumni (mentorship) + Sports (eligibility)

INTELLIGENCE & PLATFORM (Weeks 15–18)
  Phase 13: AI Layer — RAG + Tutor + Advisor + Analytics + Anomaly Detection
  Phase 14: Notifications + Customization Engine
  Phase 15: Student Portal + Guardian Portal
  Phase 16: Security Audit + Performance Optimisation
  Phase 17: DevOps + Deployment + Monitoring
  Phase 18: Integrations + Marketplace + Public API

SIS EXTENSION (after Phase 7 + 4 mature; may ship in parallel with later phases)
  Phase 19: Academic Progression — Promotion, Repeat, Resit/Carryover (.cursorrules §15)
```

---

# ════════════════════════════════════════════════════

# PHASE 0 — MONOREPO SCAFFOLDING & DATABASE SCHEMA

# Week 1 | [AGENT A]

# ════════════════════════════════════════════════════

## Prompt 0.1 — Monorepo Initialization

```
[AGENT A — Claude Opus 4]

Create a complete pnpm + Turborepo monorepo for UniCore.
Read .cursorrules Section 10 for the exact directory structure required.

Generate ALL of the following files with complete, correct contents:

1. turbo.json
   Pipeline tasks: build, test, lint, dev, db:migrate, db:seed
   Correct input/output caching per task type
   Apps api, web, admin — each independent

2. pnpm-workspace.yaml
   Declare all workspace packages

3. Root package.json
   Scripts: dev, build, test, lint, format, db:migrate, db:seed, db:studio, clean
   DevDependencies: turbo, husky, lint-staged, commitlint

4. packages/config/eslint/index.js
   Strict TypeScript ESLint: @typescript-eslint/recommended + prettier
   No unused vars, no explicit any, consistent return types

5. packages/config/typescript/base.json
   Strict: true, all strict flags enabled, path aliases configured

6. packages/config/tailwind/base.config.ts
   Shared Tailwind preset with typography plugin

7. docker-compose.yml (local development)
   Services with health checks and persistent volumes:
   - postgres:16-alpine: pgvector + pg_trgm extensions auto-created on init
   - redis:7-alpine: AOF persistence enabled
   - minio: S3-compatible, auto-creates 'unicore' bucket on start
   - mailhog: SMTP testing (port 8025 UI)
   - bull-board: BullMQ monitor UI at port 3001

8. .github/workflows/api.yml
   Triggers: pull_request to main, push to main
   Steps: pnpm install → lint → typecheck → unit tests → integration tests
          → build Docker image → push to ECR → deploy to staging (placeholder)

9. apps/api/.env.example (all vars with descriptions):
   DATABASE_URL, REDIS_URL, JWT_SECRET, JWT_REFRESH_SECRET,
   S3_BUCKET, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY, S3_ENDPOINT,
   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
   OPENAI_API_KEY, ANTHROPIC_API_KEY,
   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
   FLUTTERWAVE_SECRET_KEY, PAYSTACK_SECRET_KEY,
   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
   FIREBASE_SERVICE_ACCOUNT_JSON,
   MASTER_ENCRYPTION_KEY (for AES-256-GCM sensitive field encryption)

10. apps/web/.env.example:
    NEXTAUTH_URL, NEXTAUTH_SECRET,
    NEXT_PUBLIC_API_URL,
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
    MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET

11. Husky configuration:
    pre-commit: lint-staged (ESLint + Prettier on changed files)
    commit-msg: commitlint (conventional commits enforced)

12. .dockerignore for each app

Do NOT scaffold the internal src/ of apps yet. Monorepo shell only.
Confirm every file is syntactically valid before completing.
```

## Prompt 0.2 — Complete Database Schema

```
[AGENT A — Claude Opus 4]

Create packages/database/prisma/schema.prisma.
This is the single most critical file in the project.
It encodes the entire three-tier architecture and billing model.

Read .cursorrules Sections 5, 6, 7, 8 thoroughly before writing a line.

PRISMA CONFIGURATION:
  generator client { provider = "prisma-client-js" }
  datasource db { provider = "postgresql", extensions = [pgvector, pg_trgm, uuid_ossp] }
  previewFeatures = ["fullTextSearch", "postgresqlExtensions"]

FIELD NAMING CONVENTIONS:
  All models: camelCase in Prisma, snake_case in DB via @map and @@map
  All scoped models MUST have: institutionId, entityId, createdAt, updatedAt, deletedAt
  Standard indexes on every scoped model:
    @@index([institutionId, entityId, deletedAt])

══════════════════════════════════════════════════════
PLATFORM TIER — no institutionId (global records)
══════════════════════════════════════════════════════

Platform {
  id, name @default("UniCore"), version, maintenanceMode Boolean @default(false),
  settings Json, updatedAt
}

Institution {
  id String @id @default(cuid())
  slug String @unique                   (subdomain: "unilag")
  name String
  legalName String?
  domain String? @unique               (custom: "sis.unilag.edu.ng")
  country String
  type InstitutionType
  logo String?
  primaryColor String? @default("#1e3a5f")
  plan PlanTier
  status InstitutionStatus
  settings Json                        (SSO config, feature flags, etc.)
  billingModel BillingModel
  billingDayOfMonth Int @default(1)
  minimumBillableCount Int @default(0) (contracted floor)
  perStudentMonthlyFee Decimal @db.Decimal(10,2)
  perStudentAnnualFee Decimal @db.Decimal(10,2)
  disputeWindowDays Int @default(7)
  contractStart DateTime
  contractEnd DateTime
  timezone String @default("UTC")
  academicYearStartMonth Int @default(9) (1=Jan, 9=Sep)
  createdAt, updatedAt, deletedAt
}

enums: InstitutionType { UNIVERSITY POLYTECHNIC COLLEGE SEMINARY PROFESSIONAL_INSTITUTE }
       PlanTier { STARTER GROWTH ENTERPRISE }
       InstitutionStatus { TRIAL ACTIVE SUSPENDED TERMINATED }
       BillingModel { ANNUAL_PEAK MONTHLY_WATERMARK SEMESTER_HEADCOUNT }

InstitutionEntity {
  id, institutionId → Institution
  name, shortName, code               @@unique([institutionId, code])
  type EntityType
  coupling EntityCoupling
  billing EntityBilling
  status EntityStatus
  logo, primaryColor, customDomain? @unique
  description, location
  settings Json                      (grading system, semester type, enabled modules,
                                      payment gateway, student number format, branding)
  headPositionCode String?           (e.g. "PRINCIPAL", "DIRECTOR")
  parentEntityId String? → InstitutionEntity (sub-entities)
  createdAt, updatedAt, deletedAt
  @@index([institutionId, type])
}

enums: EntityType { MAIN_CAMPUS SCHOOL EXTRAMURAL DISTANCE_LEARNING SATELLITE_CAMPUS
                    PROFESSIONAL_SCHOOL SUMMER_SCHOOL RESEARCH_INSTITUTE
                    CONSTITUENT_COLLEGE AFFILIATE }
       EntityCoupling { INTERNAL PARTIAL EXTERNAL }
       EntityBilling { BILLED_TO_PARENT BILLED_INDEPENDENTLY EXEMPT }
       EntityStatus { PROVISIONING ACTIVE SUSPENDED INACTIVE }

AffiliateLink {
  id, institutionId, entityId → InstitutionEntity
  apiKeyHash String @unique            (SHA-256 of actual key)
  allowedScopes String[]              (STUDENT_VERIFY | TRANSCRIPT_VERIFY)
  isActive Boolean, expiresAt DateTime?
  createdAt, updatedAt
}

Subscription {
  id, institutionId, entityId String?  (null = institution-wide; set = BILLED_INDEPENDENTLY entity)
  planTier, billingModel, billingCycle BillingCycle
  baseAmount Decimal, perStudentFee Decimal, minimumCount Int
  currency String @default("USD")
  nextBillingDate, stripeCustomerId?, stripeSubscriptionId?
  status SubscriptionStatus
  createdAt, updatedAt
}

Invoice {
  id, institutionId, entityId String?
  subscriptionId → Subscription
  amount Decimal, currency
  billableCount Int                    (authoritative count for this invoice)
  billingPeriodStart, billingPeriodEnd DateTime
  isRetroactive Boolean @default(false)
  backfillRequestId String?
  status InvoiceStatus
  dueDate, paidAt DateTime?
  lineItems Json                       ([{description, entityId, count, unitFee, total}])
  evidenceS3Key String?               (S3 path to student-by-student breakdown JSON)
  stripeInvoiceId String?
  lockedAt DateTime?
  createdAt, updatedAt
}

enums: BillingCycle { MONTHLY ANNUAL SEMESTER }
       SubscriptionStatus { ACTIVE PAST_DUE CANCELLED PAUSED }
       InvoiceStatus { DRAFT OPEN PAID VOID UNCOLLECTIBLE }

══════════════════════════════════════════════════════
BILLING ENFORCEMENT MODELS — platform-computed
══════════════════════════════════════════════════════

DailyBillableSnapshot {
  id, institutionId, entityId
  snapshotDate DateTime @db.Date
  billableCount Int                    (COUNT of ACTIVE students on this day)
  isLockedForBilling Boolean @default(false)
  amendedAt DateTime?                  (only UniCore super admin can set)
  amendedBy String?
  amendmentReason String?
  createdAt DateTime @default(now())
  @@unique([institutionId, entityId, snapshotDate])
  @@index([institutionId, snapshotDate])
  -- NO updatedAt. NO deletedAt. Write-once by BillingSnapshotService only.
}

MonthlyBillableSummary {
  id, institutionId, entityId
  billingMonth Int, billingYear Int
  peakDailyCount Int
  averageDailyCount Decimal @db.Decimal(10,4)
  watermarkCount Int                   (MAX(peak, average) — used for invoice)
  invoiceId String? → Invoice
  isFinalized Boolean @default(false), finalizedAt DateTime?
  createdAt, updatedAt
  @@unique([institutionId, entityId, billingYear, billingMonth])
}

BillingEvidence {
  id, institutionId, entityId String?, invoiceId → Invoice
  billingPeriodStart, billingPeriodEnd DateTime
  s3Key String                         (JSON: [{studentId, studentNumber, entityId, status}])
  generatedAt DateTime
  @@unique([institutionId, invoiceId])
}

BillingDispute {
  id, institutionId, entityId String?, invoiceId → Invoice
  disputedStudentIds String[]
  reason String
  submittedBy String, submittedAt DateTime
  status DisputeStatus
  validationResult Json?
  resolvedBy String?, resolvedAt DateTime?, resolutionNotes String?
  billableAdjustment Int?
  createdAt, updatedAt
}

enum DisputeStatus { PENDING AUTO_VALIDATED MANUAL_REVIEW RESOLVED_ACCEPTED RESOLVED_REJECTED }

══════════════════════════════════════════════════════
STUDENT STATUS LIFECYCLE — the core billing contract
══════════════════════════════════════════════════════

Student {
  id, institutionId, entityId
  userId → User @unique
  studentNumber String               @@unique([institutionId, studentNumber])
                                     -- Unique per INSTITUTION not per entity
                                     -- Survives entity transfers unchanged
  programmeId String → OrgUnit       (the Programme OrgUnit)
  levelOfStudy String
  entryMode EntryMode
  enrollmentStatus EnrollmentStatus  -- ONLY written by StatusChangeService
  inactiveReason InactiveReason?     -- sub-reason when INACTIVE (informational only)
  inactiveSince DateTime?            -- when INACTIVE status began
  admissionDate DateTime
  expectedGraduationDate DateTime?
  actualGraduationDate DateTime?
  graduationConfirmedAt DateTime?    -- billing stops HERE (not at graduation date)
  specialNeeds Json?
  hostelId String?
  guardians Json                     ([{name, relationship, phone, email, canViewPortal}])
  emergencyContacts Json
  createdAt, updatedAt, deletedAt
  @@index([institutionId, entityId, enrollmentStatus, deletedAt])
  @@index([institutionId, entityId, inactiveSince])
}

enum EnrollmentStatus { ACTIVE INACTIVE PERMANENTLY_DELETED }
enum InactiveReason { DEFERRED RUSTICATED EXPELLED TRANSFERRED_OUT
                      GRADUATED WITHDRAWN SUSPENDED_PENDING }
enum EntryMode { UTME DIRECT_ENTRY TRANSFER POSTGRADUATE DIPLOMA CERTIFICATE }

StatusChangeLog {
  id
  institutionId, entityId, studentId → Student
  fromStatus EnrollmentStatus
  toStatus EnrollmentStatus
  fromInactiveReason InactiveReason?
  toInactiveReason InactiveReason?
  reason String                      (mandatory — cannot be empty)
  reasonCategory StatusChangeReason
  supportingDocKey String?           (S3 key)
  changedBy String                   (userId)
  changedByPosition String           (position title at time of change)
  effectiveDate DateTime             (when change takes effect)
  recordedAt DateTime @default(now())
  workflowInstanceId String?
  billingImplication BillingImplication
  approvedBy String?, approvedAt DateTime?
  -- IMMUTABLE: no updatedAt, no deletedAt, no UPDATE ever
  @@index([institutionId, entityId, studentId])
  @@index([institutionId, billingImplication, recordedAt])
}

enum StatusChangeReason { ACADEMIC_PROGRESS DISCIPLINARY MEDICAL FINANCIAL
                          PERSONAL ADMINISTRATIVE TRANSFER GRADUATION
                          WITHDRAWAL READMISSION REACTIVATION }
enum BillingImplication { GAIN LOSS RETROACTIVE_GAIN NONE }

BackfillRequest {
  id, institutionId, entityId, studentId → Student
  fromDate, toDate DateTime
  justification String
  supportingDocKey String?
  billingAcknowledged Boolean @default(false)
  estimatedRetroactiveFee Decimal @db.Decimal(10,2)
  status BackfillStatus
  workflowInstanceId String?
  approvedAt DateTime?, approvedBy String?
  invoiceId String? → Invoice         (retroactive invoice on approval)
  createdAt, updatedAt
}

BackfillWindow {
  id, institutionId, entityId, studentId → Student
  backfillRequestId → BackfillRequest
  fromDate, toDate DateTime
  isActive Boolean @default(true)
  createdAt, updatedAt
  @@index([institutionId, entityId, studentId, fromDate, toDate])
}

enum BackfillStatus { PENDING UNDER_REVIEW APPROVED REJECTED CANCELLED }

StudentTransferRecord {
  id, institutionId
  fromEntityId → InstitutionEntity
  toEntityId → InstitutionEntity
  studentId → Student
  workflowInstanceId → WorkflowInstance
  transferredAt DateTime?
  reason String
  status TransferStatus
  approvedBySrcReg String?
  approvedByDstReg String?
  approvedByInstReg String?
  createdAt, updatedAt
}

enum TransferStatus { PENDING APPROVED REJECTED CANCELLED }

══════════════════════════════════════════════════════
IDENTITY & HIERARCHICAL AUTHORITY — dual-scoped
══════════════════════════════════════════════════════

User {
  id, institutionId, entityId
  email String                        @@unique([institutionId, email])
  passwordHash String?
  isActive Boolean @default(true)
  mfaEnabled Boolean @default(false)
  mfaSecret String?                   (encrypted AES-256-GCM)
  entityScope EntityScopeType
  lastLoginAt DateTime?, lastLoginIp String?
  profile Json                        ({firstName, lastName, phone, photo, dateOfBirth,
                                        gender, nationality, address, emergencyContact})
  preferences Json                    ({language, theme, notifications, timezone})
  createdAt, updatedAt, deletedAt
}

enum EntityScopeType { ALL ENTITY }

UserEntityAccess {
  id, userId → User, entityId → InstitutionEntity
  institutionId, isActive Boolean
  grantedAt DateTime, revokedAt DateTime?
  @@unique([userId, entityId])
}

OrgUnit {
  id, institutionId, entityId
  name, code String                   @@unique([institutionId, entityId, code])
  type OrgUnitType
  parentId String? → OrgUnit          (self-referencing tree)
  isActive Boolean @default(true)
  settings Json?
  createdAt, updatedAt, deletedAt
}

enum OrgUnitType { INSTITUTION FACULTY DEPARTMENT PROGRAMME ADMIN_UNIT
                   COMMITTEE LIBRARY HOSTEL STUDENT_UNION SPORTS_UNIT }

Position {
  id, institutionId, entityId
  title, code String                  @@unique([institutionId, entityId, orgUnitId, code])
  orgUnitId → OrgUnit
  level Int                           (1=VC through 7=Lecturer/Staff)
  scope PositionScope
  permissionBundles String[]
  canDelegateTo String[]
  isUnique Boolean, isActingAllowed Boolean
  createdAt, updatedAt, deletedAt
}

enum PositionScope { INSTITUTION ENTITY FACULTY DEPARTMENT PROGRAMME UNIT SECTION PERSONAL }

PositionHolder {
  id, institutionId, entityId
  positionId → Position, userId → User
  startDate, endDate DateTime?
  isActing Boolean @default(false)
  delegatedBy String?
  appointedBy → User
  createdAt, updatedAt
}

PermissionBundle {
  id, institutionId?, entityId?        (null = platform default)
  code, name, description
  permissions String[]
  createdAt, updatedAt
}

══════════════════════════════════════════════════════
WORKFLOW ENGINE — dual-scoped
══════════════════════════════════════════════════════

WorkflowDefinition {
  id, institutionId, entityId?         (null = institution-wide template)
  name, code String                    @@unique([institutionId, entityId, code])
  scope WorkflowScope
  triggerEntity, triggerEvent String
  steps Json                           ([{stepNumber, name, assignedTo, slaHours,
                                          actionOptions, escalatesTo, requiredFields}])
  isActive Boolean
  createdAt, updatedAt
}

WorkflowInstance {
  id, institutionId, entityId
  definitionId → WorkflowDefinition
  entityType String, entityId_record String
  currentStep Int, status WorkflowStatus
  initiatedBy → User, initiatedAt DateTime
  completedAt DateTime?, completedBy String?
  history Json                         ([{step, actorId, actorPosition, action, notes, decidedAt}])
  dueAt DateTime
  metadata Json?
  createdAt, updatedAt
}

enum WorkflowScope { ENTITY INSTITUTION CROSS_ENTITY }
enum WorkflowStatus { PENDING IN_PROGRESS APPROVED REJECTED CANCELLED ESCALATED }

══════════════════════════════════════════════════════
ACADEMIC STRUCTURE — dual-scoped
══════════════════════════════════════════════════════

AcademicYear { id, institutionId, entityId, name, startDate, endDate, isCurrent Boolean }

Semester {
  id, institutionId, entityId, academicYearId → AcademicYear
  name, type SemesterType
  startDate, endDate DateTime
  registrationOpen, registrationClose DateTime
  gradeSubmissionDeadline DateTime
  isActive Boolean
  censusDate DateTime?                 (for SEMESTER_HEADCOUNT billing model)
  createdAt, updatedAt, deletedAt
}

Course {
  id, institutionId, entityId
  orgUnitId → OrgUnit                  (department that owns this course)
  code, title String
  creditHours Int, level String, type CourseType
  description String?, prerequisites String[]
  learningOutcomes Json, syllabus Json
  isActive Boolean
  createdAt, updatedAt, deletedAt
}

Section {
  id, institutionId, entityId
  courseId → Course, semesterId → Semester
  instructorId → User
  code String, maxEnrollment Int, currentEnrollment Int @default(0)
  schedule Json                        ({days, startTime, endTime, recurrence})
  roomId String? → Room
  mode SectionMode
  createdAt, updatedAt, deletedAt
}

Room { id, institutionId, entityId, building, name, capacity Int, type, facilities Json }

SharedCourse {
  id, institutionId
  courseId → Course, semesterId → Semester
  offeringEntityId → InstitutionEntity
  allowedEntityIds String[]           (which entities' students can cross-enroll)
  maxCrossEnrollment Int?
  isActive Boolean
  createdAt, updatedAt
}

AuditLog {
  id, institutionId?, entityId?
  actorId?, actorPosition?
  action String, entity String, entityId_record String
  oldValues Json?, newValues Json?
  ipAddress?, userAgent?
  isCrossEntity Boolean @default(false)
  billingImplication BillingImplication?
  workflowId String?
  createdAt DateTime @default(now())
  -- IMMUTABLE: no updatedAt, no deletedAt
}

══════════════════════════════════════════════════════
SIS MODELS — dual-scoped
══════════════════════════════════════════════════════

ApplicationForm { id, institutionId, entityId, name, schema Json, version Int, isActive }

AdmissionCycle {
  id, institutionId, entityId
  name, academicYearId → AcademicYear
  programmeOrgUnitId String?
  applicationOpenDate, applicationCloseDate, status AdmissionStatus
  quota Json                           ({byProgramme: [{programmeId, slots}]})
  formSchemaId → ApplicationForm?
  entryRequirements Json
  createdAt, updatedAt, deletedAt
}

Application {
  id, institutionId, entityId
  cycleId → AdmissionCycle
  applicantUserId → User
  programmeId → OrgUnit
  status ApplicationStatus
  applicationNumber String            @@unique([institutionId, applicationNumber])
  personalStatement String?
  documents Json                       ([{type, fileKey, verifiedAt}])
  formData Json
  reviewNotes Json                     ([{reviewerId, note, createdAt}])
  admissionScore Decimal?
  decisionBy String?, decisionAt DateTime?
  offerExpiry DateTime?, offerAcceptedAt DateTime?
  createdAt, updatedAt, deletedAt
}

StudentEnrollment {
  id, institutionId, entityId          (student's home entity)
  studentId → Student
  sectionId → Section
  semesterId → Semester
  offeringEntityId String?             (set for cross-entity enrollments)
  status EnrollmentSectionStatus
  grade Json?                          ({rawScore, weightedScore, letterGrade, gradePoints, isPublished})
  enrolledAt, droppedAt DateTime?
  completedAt DateTime?
  droppedReason String?
  createdAt, updatedAt, deletedAt
}

EnrollmentHold {
  id, institutionId, entityId, studentId → Student
  type HoldType                        (FINANCIAL | ACADEMIC | ADMINISTRATIVE | LIBRARY | DISCIPLINARY)
  placedBy String, placedByPosition String
  reason String
  resolvedAt DateTime?, resolvedBy String?
  autoReleaseDate DateTime?
  createdAt, updatedAt, deletedAt
}

GradingScale {
  id, institutionId, entityId, name, isDefault Boolean
  scale Json                           ([{min, max, letter, points, remark}])
  createdAt, updatedAt
}

GradeSubmissionBatch {
  id, institutionId, entityId
  sectionId → Section, semesterId → Semester
  submittedBy String, status GradeSubmissionStatus
  workflowInstanceId String?
  submittedAt, publishedAt DateTime?
  createdAt, updatedAt
}

AttendanceSession {
  id, institutionId, entityId, sectionId → Section
  sessionDate DateTime, conductedBy → User
  qrCode String @unique, qrExpiresAt DateTime
  isLocked Boolean @default(false)
  createdAt, updatedAt
}

AttendanceRecord {
  id, institutionId, entityId
  sessionId → AttendanceSession, studentId → Student
  status AttendanceStatus
  markedAt DateTime, markedBy String?, markedMethod AttendanceMethod
  createdAt, updatedAt
}

TranscriptRequest {
  id, institutionId, entityId, studentId → Student
  type TranscriptType, purpose String, addressedTo String?
  status DocumentRequestStatus
  workflowInstanceId String?
  createdAt, updatedAt
}

Document {
  id, institutionId, entityId, ownerId String
  type DocumentType, title String
  fileKey String, checksum String
  verificationCode String @unique
  status DocumentStatus
  issuedAt DateTime?, expiresAt DateTime?, issuedBy String?
  isBackfilled Boolean @default(false)
  backfillRequestId String?
  createdAt, updatedAt
}

DocumentTemplate {
  id, institutionId, entityId
  type DocumentType, name String, templateKey String
  version Int, isActive Boolean
  requiredFields Json
  createdAt, updatedAt
}

ClearanceType {
  id, institutionId, entityId
  name String, responsibleOrgUnitId → OrgUnit
  requiredFor String[]                 (GRADUATION | WITHDRAWAL | TRANSCRIPT)
  checklistItems Json
  createdAt, updatedAt
}

ClearanceRequest {
  id, institutionId, entityId, studentId → Student
  purpose ClearancePurpose
  workflowInstanceId String
  clearances Json                      ([{typeId, status, clearedBy, clearedAt, notes}])
  overallStatus ClearanceStatus
  createdAt, updatedAt
}

══════════════════════════════════════════════════════
LMS MODELS — dual-scoped
══════════════════════════════════════════════════════

CourseInstance {
  id, institutionId, entityId, sectionId → Section
  isPublished Boolean, coverImage String?
  welcomeMessage String?, completionCriteria Json, settings Json
  createdAt, updatedAt
}

LmsModule {
  id, institutionId, entityId, courseInstanceId → CourseInstance
  title, order Int, isPublished Boolean
  unlockAfterDate DateTime?, unlockAfterModuleId String?
  createdAt, updatedAt
}

Lesson {
  id, institutionId, entityId, moduleId → LmsModule
  title String, type LessonType, contentJson Json
  durationMinutes Int, order Int, isPublished Boolean
  aiSummary String?, aiKeyPoints Json?
  isBackfilled Boolean @default(false), backfillRequestId String?
  createdAt, updatedAt
}

Assessment {
  id, institutionId, entityId, courseInstanceId → CourseInstance
  title String, type AssessmentType
  instructions String?, dueDate DateTime
  totalPoints Int, weight Decimal @db.Decimal(5,2)
  gradingType GradingType, settings Json, rubric Json?
  questionBankTags String[]
  isBackfilled Boolean @default(false), backfillRequestId String?
  createdAt, updatedAt
}

Question {
  id, institutionId, entityId
  assessmentId String?, type QuestionType
  content Json, options Json?, correctAnswer Json?, explanation String?
  points Int, difficulty DifficultyLevel, tags String[]
  isPooled Boolean @default(false)
  createdAt, updatedAt
}

QuizAttempt {
  id, institutionId, entityId
  assessmentId → Assessment, studentId → Student
  attemptNumber Int, status AttemptStatus
  startedAt, submittedAt DateTime?
  answers Json, timeSpentSeconds Int
  autoScore Decimal?, finalScore Decimal?
  gradedBy String?, gradedAt DateTime?
  isBackfilled Boolean @default(false), backfillRequestId String?
  createdAt, updatedAt
}

Submission {
  id, institutionId, entityId
  assessmentId → Assessment, studentId → Student
  status SubmissionStatus
  submittedAt DateTime, content String?, fileKeys String[]
  plagiarismScore Decimal?, plagiarismReport Json?
  grade Json?, gradedBy String?, gradedAt DateTime?
  feedback String?, peerReviews Json?
  isBackfilled Boolean @default(false), backfillRequestId String?
  createdAt, updatedAt
}

Discussion { id, institutionId, entityId, courseInstanceId, title, isPinned, isLocked, type }
DiscussionPost { id, institutionId, entityId, discussionId, authorId, content, parentId?,
                 upvotes Int, isInstructorAnswer Boolean, createdAt, updatedAt }

StudentProgress {
  id, institutionId, entityId, studentId → Student, courseInstanceId → CourseInstance
  completedLessons String[], completedModules String[]
  lastAccessedAt DateTime, totalTimeSpentMinutes Int, progressPercent Decimal
  isCompleted Boolean, completedAt DateTime?
  createdAt, updatedAt
}

EmbeddingDocument {
  id, institutionId, entityId
  sourceType String, sourceId String, content String
  embedding Unsupported("vector(1536)")
  metadata Json
  createdAt DateTime @default(now())
  @@index([institutionId, entityId, sourceType])
}

AITutorSession {
  id, institutionId, entityId, studentId → Student
  courseInstanceId → CourseInstance
  messages Json, tokensUsed Int, createdAt DateTime @default(now())
}

══════════════════════════════════════════════════════
FINANCE MODELS — dual-scoped
══════════════════════════════════════════════════════

FeeStructure {
  id, institutionId, entityId, name, academicYearId → AcademicYear
  programmeIds String[], isDefault Boolean
  items Json                           ([{code, name, amount, mandatory, billedAt}])
  createdAt, updatedAt
}

StudentAccount {
  id, institutionId, entityId, studentId → Student @unique
  balance Decimal @default(0), currency String
  lastTransactionAt DateTime?
  createdAt, updatedAt
}

Transaction {
  id, institutionId, entityId, studentAccountId → StudentAccount
  type TransactionType, amount Decimal, currency String
  description String, reference String @unique
  paymentMethod String?, gatewayRef String?, gatewayResponse Json?
  status TransactionStatus
  processedAt DateTime?, processedBy String?
  approvedBy String?, approvalWorkflowId String?
  isReversed Boolean @default(false), reversedTransactionId String?
  createdAt                            (immutable — no updatedAt)
}

PaymentPlan {
  id, institutionId, entityId, studentAccountId → StudentAccount
  totalAmount Decimal, currency String
  installments Json                    ([{seq, dueDate, amount, status, paidAt, transactionId}])
  status PaymentPlanStatus, createdBy String
  createdAt, updatedAt
}

Scholarship {
  id, institutionId, entityId, name, type ScholarshipType
  fundingSource String, totalFund Decimal, disbursedAmount Decimal @default(0)
  conditions Json, applicationSchemaId String?
  createdAt, updatedAt
}

ScholarshipAward {
  id, institutionId, entityId
  scholarshipId → Scholarship, studentId → Student
  amount Decimal, academicYearId → AcademicYear
  status AwardStatus, workflowInstanceId String?
  awardedBy String, disbursedAt DateTime?
  createdAt, updatedAt
}

BankIntegration {
  id, institutionId, entityId
  provider String, config Json          (encrypted), isActive Boolean
  webhookSecret String?
  createdAt, updatedAt
}

══════════════════════════════════════════════════════
HR MODELS — dual-scoped
══════════════════════════════════════════════════════

StaffProfile {
  id, institutionId, entityId, userId → User
  staffNumber String                   @@unique([institutionId, staffNumber])
  orgUnitId → OrgUnit
  positionId → Position
  employmentType EmploymentType
  contractStart, contractEnd DateTime?
  salary Json?                         (encrypted)
  qualifications Json, specializations String[]
  publications Json, researchInterests String[]
  officeLocation String?
  createdAt, updatedAt, deletedAt
}

LeaveType { id, institutionId, entityId, name, code, annualAllocation Int,
            carryOverLimit Int, requiresApproval Boolean, isPaid Boolean }

LeaveBalance {
  id, institutionId, entityId, staffId → StaffProfile, leaveTypeId → LeaveType
  academicYearId → AcademicYear
  allocated Int, used Int, pending Int, carriedOver Int
  createdAt, updatedAt
}

LeaveRequest {
  id, institutionId, entityId, staffId → StaffProfile, leaveTypeId → LeaveType
  startDate, endDate DateTime, durationDays Int
  reason String, supportingDocKey String?
  status LeaveStatus, workflowInstanceId String, coveringStaffId String?
  createdAt, updatedAt
}

Appraisal {
  id, institutionId, entityId, staffId → StaffProfile, reviewerId → User
  periodStart, periodEnd DateTime, type AppraisalType
  kpiScores Json, selfAssessment String, reviewerComments String
  overallRating Decimal?, status AppraisalStatus
  workflowInstanceId String?
  createdAt, updatedAt
}

WorkloadRecord {
  id, institutionId, entityId, staffId → StaffProfile, semesterId → Semester
  assignedSections Json                ([{sectionId, creditHours, role}])
  totalCreditHours Int, maxCreditHours Int
  researchHours Int @default(0), adminHours Int @default(0)
  createdAt, updatedAt
}

══════════════════════════════════════════════════════
ELECTIONS — dual-scoped
══════════════════════════════════════════════════════

Election {
  id, institutionId, entityId
  title, description String, type ElectionType
  eligibilityOrgUnitId String?         (null = institution-wide)
  eligibilityRules Json
  positions Json                       ([{title, description, maxCandidates}])
  nominationOpenDate, nominationCloseDate DateTime
  votingOpenDate, votingCloseDate DateTime
  status ElectionStatus
  resultsPublishedAt DateTime?, certifiedBy String?
  createdAt, updatedAt, deletedAt
}

Candidate {
  id, institutionId, entityId
  electionId → Election, userId → User, position String
  manifesto String, manifestoDocKey String?, photo String?
  nominatedBy String, secondedBy String?
  status CandidateStatus, rejectionReason String?
  createdAt, updatedAt
}

ElectionVoter {
  id, institutionId, entityId
  electionId → Election, userId → User
  hasVoted Boolean @default(false), votedAt DateTime?
  verificationToken String? @unique
  @@unique([electionId, userId])
}

ElectionVote {
  id, institutionId, entityId
  electionId → Election
  voterHash String                     (SHA-256(electionId + userId + institutionSecret))
  position String, candidateId → Candidate
  castAt DateTime, verificationToken String @unique
  @@unique([electionId, voterHash, position])
  -- voterHash: voter can verify their vote was counted
  -- but vote record has no direct userId link (anonymity preserved)
}

══════════════════════════════════════════════════════
MEETINGS — dual-scoped
══════════════════════════════════════════════════════

Meeting {
  id, institutionId, entityId
  title, type MeetingType
  convenerPositionId → Position, orgUnitId → OrgUnit
  scheduledAt DateTime, durationMinutes Int
  location String?, meetingLink String?
  status MeetingStatus
  quorumRequired Int, quorumMet Boolean?
  agenda Json                          ([{itemNumber, title, presenter, duration, type}])
  minutesFileKey String?, minutesDraftKey String?
  minutesApprovedAt DateTime?, minutesApprovedBy String?
  isConfidential Boolean @default(false)
  createdAt, updatedAt, deletedAt
}

MeetingAttendee {
  id, institutionId, entityId
  meetingId → Meeting, userId → User, positionId → Position
  inviteStatus InviteStatus, isRequired Boolean
  attended Boolean?, arrivalTime DateTime?, departureTime DateTime?
  apology String?
  createdAt, updatedAt
}

AgendaItem {
  id, institutionId, entityId, meetingId → Meeting
  itemNumber String, title, description String?, presenterId String?
  duration Int, order Int, type AgendaItemType
  papers Json, discussion String?, decision String?
  actionItems Json                     ([{description, assignedTo, dueDate, status}])
  createdAt, updatedAt
}

Resolution {
  id, institutionId, entityId, meetingId → Meeting, agendaItemId → AgendaItem
  resolutionNumber String
  title, content String
  movedBy, secondedBy String
  votesFor Int, votesAgainst Int, abstentions Int
  outcome ResolutionOutcome
  implementedAt DateTime?, implementedBy String?
  createdAt, updatedAt
}

══════════════════════════════════════════════════════
ALUMNI — dual-scoped
══════════════════════════════════════════════════════

AlumniProfile {
  id, institutionId, entityId, userId → User
  studentId → Student?                 (linked to their student record)
  graduationYear Int, programmeId → OrgUnit
  currentEmployer String?, jobTitle String?, industry String?
  linkedinUrl String?, bio String?
  isVerified Boolean, isPublic Boolean
  chapters String[], mentorshipAvailable Boolean
  expertiseAreas String[], geoLocation Json?
  createdAt, updatedAt, deletedAt
}

AlumniChapter { id, institutionId, entityId?, name, region, country,
                coordinatorId → User, isActive, foundedYear Int?, memberCount Int }

AlumniEvent {
  id, institutionId, entityId?, chapterId String?
  title, description String, type AlumniEventType
  startDate, endDate DateTime, location String?, isVirtual Boolean
  registrationDeadline DateTime?, capacity Int?, fee Decimal @default(0)
  registrations Json, createdAt, updatedAt, deletedAt
}

MentorshipProgram { id, institutionId, entityId, name, description, startDate, endDate, isActive }

MentorshipPair {
  id, institutionId, entityId
  programId → MentorshipProgram, mentorId → User, menteeId → User
  status MentorshipStatus, goals Json
  sessionCount Int @default(0), nextSessionDate DateTime?
  rating Decimal?, feedback String?
  createdAt, updatedAt
}

FundraisingCampaign {
  id, institutionId, entityId?, title, description String
  targetAmount Decimal, raisedAmount Decimal @default(0)
  currency String, startDate, endDate DateTime
  status CampaignStatus
  donations Json                       ([{donorId, amount, anonymous, message, paidAt}])
  createdAt, updatedAt
}

JobPosting {
  id, institutionId, entityId?, postedByAlumniId → User
  title, company, description String
  requirements String[], salary String?, location String
  type JobType, deadline DateTime?
  applications Json, isActive Boolean
  createdAt, updatedAt
}

══════════════════════════════════════════════════════
SPORTS — dual-scoped
══════════════════════════════════════════════════════

SportType { id, institutionId, entityId, name, category SportCategory,
            season SportSeason, rulesDocKey String? }

Team {
  id, institutionId, entityId, sportTypeId → SportType
  name, gender TeamGender, level TeamLevel
  coachId → User, assistantCoachIds String[]
  academicYearId → AcademicYear
  homeVenue String?, colors Json?, logo String?
  createdAt, updatedAt, deletedAt
}

Player {
  id, institutionId, entityId, teamId → Team, studentId → Student
  position String?, jerseyNumber String?
  joinedDate DateTime, isActive Boolean, isEligible Boolean
  ineligibilityReason String?          (e.g. "GPA below minimum 2.0")
  medicalClearance Boolean @default(false)
  createdAt, updatedAt
}

SportsFacility {
  id, institutionId, entityId, name, type, capacity Int
  location, amenities String[]
  maintenanceSchedule Json
  bookingRules Json
  createdAt, updatedAt
}

FacilityBooking {
  id, institutionId, entityId, facilityId → SportsFacility
  bookedBy → User, teamId String?, purpose String
  startTime, endTime DateTime
  status BookingStatus, attendeeCount Int?, notes String?
  createdAt, updatedAt
}

Competition {
  id, institutionId, entityId?, name, type CompetitionType
  sportTypeId → SportType, organizerId → User
  startDate, endDate DateTime, venue String
  participantTeams Json, status CompetitionStatus
  createdAt, updatedAt, deletedAt
}

Fixture {
  id, institutionId, entityId?
  competitionId → Competition, homeTeamId → Team, awayTeamId → Team
  scheduledAt DateTime, venue String
  status FixtureStatus, score Json?, statistics Json?
  matchReport String?, streamUrl String?
  createdAt, updatedAt
}

══════════════════════════════════════════════════════
NOTIFICATIONS — dual-scoped
══════════════════════════════════════════════════════

NotificationTemplate {
  id, institutionId?, entityId?         (null = platform default)
  event String, channels Json           ({email, sms, push, inApp})
  subject String?, htmlBody String, textBody String
  createdAt, updatedAt
}

Notification {
  id, institutionId, entityId, recipientId → User
  type, title, body String, data Json?
  channels String[], readAt DateTime?
  createdAt
}

══════════════════════════════════════════════════════
After writing the schema:
1. Generate the migration: npx prisma migrate dev --name init
2. Add ivfflat index on EmbeddingDocument.embedding for pgvector
3. Add GIN indexes on all Json and String[] columns
4. Generate seed files with demo data:
   - 1 institution, 3 entities (MAIN_CAMPUS, EXTRAMURAL, DISTANCE_LEARNING)
   - Platform super admin user
   - Institution VC user (entityScope: ALL)
   - 3 entity principals (one per entity)
   - 5 students per entity in mixed statuses with StatusChangeLogs
   - Sample courses, sections, and enrollments
══════════════════════════════════════════════════════
```

---

# ════════════════════════════════════════════════════

# PHASE 1 — AUTHENTICATION, GUARDS & ENTITY SWITCHER

# Week 2 | [AGENT A] + [AGENT B]

# ════════════════════════════════════════════════════

## Prompt 1.1 — NestJS Auth System

```
[AGENT A — Claude Opus 4]

Build the complete authentication system in apps/api/src/modules/auth/.
This system must be fully entity-aware and include billing-critical logout logic.

PART A — TENANT + ENTITY RESOLVER MIDDLEWARE
File: apps/api/src/common/middleware/tenant-entity-resolver.middleware.ts

Resolution sources:
  institution: subdomain (unilag.unicore.io), custom domain, X-Institution-ID header
  entity:      sub-subdomain (ext.unilag.unicore.io), X-Entity-ID header
Attach to request: req.institution, req.entity
Cache both in Redis: institution TTL 5min, entity TTL 5min
Throw 404: institution or entity not found
Throw 403: institution SUSPENDED or entity SUSPENDED

PART B — JWT STRATEGY
Access token payload (15min TTL):
  { sub, email, institutionId, entityId, entityScope (ALL|ENTITY),
    positionCode, positionLevel, positionScope, orgUnitId,
    permissionBundles, permissions (expanded), isSuperAdmin }
Refresh token: 7 days, httpOnly secure cookie + Redis
Redis key pattern: refresh:{institutionId}:{entityId}:{userId}:{tokenId}

PART C — PRISMA TENANT MIDDLEWARE
File: apps/api/src/prisma/prisma-tenant.middleware.ts
Use AsyncLocalStorage to store { institutionId, entityId, entityScope } per request.
entityScope ALL   → inject: where { institutionId, deletedAt: null }
entityScope ENTITY → inject: where { institutionId, entityId, deletedAt: null }
Super admin bypass flag in AsyncLocalStorage skips injection.
Log CRITICAL if a scoped model query has no institutionId.

PART D — STUDENT INSTANT LOGOUT TOOLS (used by StatusChangeService)
Method: InvalidateStudentSessions(userId, institutionId)
  a) SMEMBERS user_jtis:{userId}  → get all active JTI strings
  b) For each JTI: SET token_blocked:{jti} 1 EX {remainingTtl}
  c) DEL refresh:{institutionId}:*:{userId}:* (pattern delete)
  d) DEL user_jtis:{userId}
  (On every login: SADD user_jtis:{userId} {jti} with matching TTL)

Method: TerminateStudentSockets(userId)
  Emit 'session.terminated' to socket room: user:{userId}
  Payload: { reason: 'ACCOUNT_DEACTIVATED', message: 'Your access has been deactivated by your institution.' }

PART E — JWT BLOCKLIST IN JwtAuthGuard
On every request: GET token_blocked:{jti} → if exists → throw 401

PART F — ENTITY SWITCHER ENDPOINT
POST /auth/switch-entity { targetEntityId }
  Validate: UserEntityAccess exists for targetEntityId + institutionId matches
  Validate: targetEntity status = ACTIVE
  Validate: targetEntity coupling != EXTERNAL (affiliates cannot switch to)
  Compute new position + permissions for this entity
  Issue fresh JWT (access + refresh rotation)
  Revoke old refresh token

PART G — AUTH FLOWS
  Email/password (bcrypt cost factor 12)
  Magic link OTP (6-digit, 10min TTL, Redis)
  Google OAuth (if institution settings.ssoProvider = 'GOOGLE')
  Microsoft Azure AD (if settings.ssoProvider = 'MICROSOFT')
  SAML 2.0 (enterprise — settings.ssoProvider = 'SAML')
  TOTP MFA via speakeasy (if user.mfaEnabled)

PART H — ALL GUARDS (apps/api/src/common/guards/)
  jwt-auth.guard.ts          (global — includes JWT blocklist check)
  entity-scope.guard.ts      (validates entityId ownership of resource)
  student-record-posting.guard.ts ← see Prompt 1.2
  position.guard.ts
  permission.guard.ts
  scope.guard.ts
  super-admin.guard.ts
  affiliate-api-key.guard.ts

PART I — ALL DECORATORS (apps/api/src/common/decorators/)
  @CurrentUser() @CurrentPosition() @CurrentInstitution() @CurrentEntity()
  @RequirePosition(...codes) @RequirePermission(...perms) @RequireScope(scope)
  @Public() @SuperAdminOnly() @EntityScopeAll()
  @StudentIdParam(path) ← specifies where studentId is in request
  @BypassRecordGuard() ← only valid with @SuperAdminOnly()

Generate all files with DTOs, unit tests, OpenAPI decorators.
Rate limiting: 5 attempts per 15 minutes on all /auth/* endpoints.
```

## Prompt 1.2 — StudentRecordPostingGuard

```
[AGENT A — Claude Opus 4]

Build the StudentRecordPostingGuard.
This is the most important business-logic guard in the system.
It enforces the billing contract at the infrastructure level.

File: apps/api/src/common/guards/student-record-posting.guard.ts

COMPLETE IMPLEMENTATION:

@Injectable()
export class StudentRecordPostingGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService,
              private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {

    // Check for super admin bypass
    const bypass = this.reflector.getAllAndOverride('bypassRecordGuard',
      [context.getHandler(), context.getClass()])
    const user = context.switchToHttp().getRequest().user
    if (bypass && user?.isSuperAdmin) return true

    const request = context.switchToHttp().getRequest()

    // Extract studentId using @StudentIdParam decorator metadata
    const studentIdPath = this.reflector.get('studentIdParam', context.getHandler())
    const studentId = studentIdPath
      ? get(request, studentIdPath)  // lodash get for nested paths
      : request.params?.studentId || request.body?.studentId

    // If no studentId — this endpoint doesn't target a specific student
    if (!studentId) return true

    // Determine the date this record is for (most records = today)
    const recordDate = request.body?.effectiveDate
      || request.body?.sessionDate
      || request.body?.attendanceDate
      || new Date()

    // Fetch student — lean query (status + entity only)
    const student = await this.prisma.student.findFirst({
      where: { id: studentId },
      select: { enrollmentStatus: true, entityId: true, institutionId: true }
    })
    if (!student) throw new NotFoundException('Student not found')

    // RULE 1: ACTIVE students — always allow
    if (student.enrollmentStatus === EnrollmentStatus.ACTIVE) return true

    // RULE 2: Check for approved BackfillWindow covering this date
    const window = await this.prisma.backfillWindow.findFirst({
      where: {
        studentId,
        institutionId: student.institutionId,
        isActive: true,
        fromDate: { lte: recordDate },
        toDate:   { gte: recordDate }
      }
    })
    if (window) {
      // Attach backfill context — services use this to flag records
      request.backfillContext = {
        isBackfilled: true,
        backfillRequestId: window.backfillRequestId,
        backfillWindowId: window.id
      }
      return true
    }

    // RULE 3: INACTIVE with no approved backfill — BLOCK
    throw new ForbiddenException({
      statusCode: 403,
      errorCode: 'STUDENT_INACTIVE',
      message: 'Cannot post records for an inactive student.',
      studentStatus: student.enrollmentStatus,
      resolution: 'Reactivate the student first. Or submit a backfill request '
                + 'to post records for this inactive period — note that '
                + 'approval triggers retroactive billing for the full period.'
    })
  }
}

Apply this guard on EVERY endpoint in these modules:
  grades: all POST/PUT/PATCH endpoints
  attendance: all mark/create endpoints
  enrollment: all register/enroll endpoints
  lms: all submission/completion endpoints
  finance: all charge/debit endpoints (NOT payment receipt)
  documents: all issue endpoints

Build comprehensive test suite:
  ACTIVE student → guard passes
  INACTIVE student, no backfill → 403 with correct errorCode
  INACTIVE student, valid BackfillWindow → passes, request.backfillContext set
  INACTIVE student, BackfillWindow expired → 403
  INACTIVE student, BackfillWindow for different period → 403
  Super admin with @BypassRecordGuard → passes
  Non-super-admin with @BypassRecordGuard → 403
```

## Prompt 1.3 — Next.js Auth + Entity Switcher

```
[AGENT B — Claude Sonnet 4]

Build authentication and entity context for apps/web.

1. NextAuth v5 config (apps/web/src/lib/auth.ts)
   Providers: Credentials (→ POST /auth/login), Google, Microsoft
   Session strategy: JWT
   Session contains full JWT payload from backend including entityId + entityScope
   Callbacks: JWT callback expands session with all position fields

2. Middleware (apps/web/middleware.ts)
   Protect all routes under /(institution)/*
   Detect entity subdomain → set X-Entity-ID header
   Role-based protection:
     /entities/* → entityScope: ALL only
     /billing/* → BILLING_VIEW permission
     /teach/* → position level 7 or lower with teaching role
     /settings/* → position level 3 or lower (admin)

3. Hooks (apps/web/src/hooks/)
   useEntityContext():
     Returns { entityId, entityName, entityType, entityCoupling,
               entityScope, canSeeAllEntities,
               switchEntity(targetEntityId): Promise<void> }
     switchEntity: calls POST /auth/switch-entity → updates session

   useStudentStatus(studentId):
     Returns { isActive: boolean, status: EnrollmentStatus,
               inactiveReason: InactiveReason | null,
               inactiveSince: Date | null, canPostRecords: boolean }
     Used by all student-related forms to enforce read-only mode

   usePermission(permission: string): boolean
   usePosition(): { code, level, scope, orgUnitId }
   useCurrentUser(): session user object

4. Components (apps/web/src/components/)
   <EntityScopeGate scope="ALL">  — shows children only to ALL-scope users
   <PermissionGate permission="billing:view">  — shows by permission
   <PositionGate position={["HOD","DEAN"]}>  — shows by position code

5. Login page (apps/web/src/app/(auth)/login/page.tsx)
   Step 1: Institution lookup (slug or domain input)
   Step 2: Entity selection (if institution has multiple + user has access)
   Step 3: Email + password OR SSO button (based on institution settings)
   Step 4: MFA entry (if user.mfaEnabled)
   Loading states, error states, redirect to intended page after login.
   Institution logo displayed after step 1 (fetched from public endpoint).
   Design: clean, professional, academic. shadcn Form + Input + Button.
   Framer Motion transitions between steps.
```

---

# ════════════════════════════════════════════════════

# PHASE 2 — INSTITUTION ENTITY MODULE

# Week 2–3 | [AGENT B] + [AGENT C]

# ════════════════════════════════════════════════════

## Prompt 2.1 — InstitutionEntity Backend

```
[AGENT B — Claude Sonnet 4]

Build apps/api/src/modules/institution-entities/.
Entity management is restricted to institution-level authority (VC/Registrar).
Entity admins CANNOT create or modify their own entity record.

InstitutionEntitiesService:

createEntity(dto, actorId):
  a) Validate: only 1 MAIN_CAMPUS allowed per institution
  b) Validate: AFFILIATE type requires explicit coupling: EXTERNAL
  c) Create InstitutionEntity with status: PROVISIONING
  d) Dispatch EntityProvisioningJob to BullMQ:
     Job: apps/api/src/jobs/students/entity-provision.processor.ts
     Steps:
       i.   Create default OrgUnit tree based on entity type:
              MAIN_CAMPUS:       Faculty → Dept → Programme tree
              EXTRAMURAL:        Division → Programme tree
              SCHOOL:            Sub-faculty → Dept → Programme tree
              DISTANCE_LEARNING: Online Faculty → Course Group tree
              AFFILIATE:         Single root OrgUnit only
       ii.  Create head Position record (PRINCIPAL/DIRECTOR/PROVOST)
       iii. Copy WorkflowDefinitions from institution template
            (clone all institution-level definitions to entity scope)
       iv.  If BILLED_INDEPENDENTLY: create separate Subscription record
       v.   Initialise entity settings from EntityType defaults
       vi.  Set status: ACTIVE
       vii. Emit 'entity.provisioned' event
  e) Return entity (caller polls status until ACTIVE)

updateEntity(id, dto):
  Updatable: name, shortName, description, location, logo, primaryColor,
             customDomain, settings (partial merge)
  NOT updatable: type, coupling, institutionId, code

suspendEntity(id, reason):
  Set status: SUSPENDED
  Redis: flush all sessions for all users where User.entityId = this entity
  Block new logins for entity users (resolver middleware checks entity status)

getEntityStats(entityId):
  activeStudents: from latest DailyBillableSnapshot.billableCount
  totalStudents: COUNT of students with this entityId
  inactiveStudents: totalStudents - activeStudents
  staff: COUNT of StaffProfile with this entityId
  enrollments: COUNT of StudentEnrollment this semester
  storage: (aggregate of S3 usage for this entity — cached)

getConsolidatedStats(institutionId):
  Aggregate getEntityStats for ALL entities in institution
  Returns [{ entity, stats }] + institutionTotals
  Required for VC/Registrar dashboard

UserEntityAccessService:
  grantAccess(userId, entityId, grantedBy): create UserEntityAccess
  revokeAccess(userId, entityId): set isActive false + revokedAt
  getUserEntities(userId): list all accessible entities
  Used for: shared lecturers teaching in Main Campus + Extramural simultaneously

AffiliateService:
  createAffiliateLink(entityId, scopes[], expiresAt?):
    Generate random API key (32 bytes)
    Store SHA-256 hash in AffiliateLink.apiKeyHash
    Return plaintext key ONCE (never stored again)
  verifyStudentEnrollment(apiKey, studentNumber):
    PUBLIC endpoint — no JWT required
    AffiliateApiKeyGuard validates key hash
    Validate scope includes STUDENT_VERIFY
    Return: { enrolled: boolean, programme: string } ONLY — no PII
  verifyTranscriptCode(apiKey, verificationCode):
    AffiliateApiKeyGuard validates key hash
    Validate scope includes TRANSCRIPT_VERIFY
    Return: { valid: boolean, type: string, issuedAt: string, institution: string }

CONTROLLER endpoints:
  POST   /institution-entities              (VC/Registrar only)
  GET    /institution-entities              (list all for institution)
  GET    /institution-entities/stats        (consolidated stats — ALL scope)
  GET    /institution-entities/:id          (detail + stats)
  PATCH  /institution-entities/:id          (VC/Registrar only)
  POST   /institution-entities/:id/suspend
  POST   /institution-entities/:id/activate
  POST   /institution-entities/:id/user-access
  DELETE /institution-entities/:id/user-access/:userId
  GET    /affiliate/verify-student          (public — AffiliateApiKeyGuard)
  GET    /affiliate/verify-transcript       (public — AffiliateApiKeyGuard)

Generate service, controller, BullMQ processor, DTOs, tests.
```

## Prompt 2.2 — Entity Management + Switcher UI

```
[AGENT C — GPT-4o]

Build entity management pages in apps/web.
Accessible only to users with entityScope: ALL.

Design language:
  Deep navy (#1e3a5f) header, clean white content, amber (#f59e0b) for billable numbers.
  Entity type cards: each type has a distinct icon and accent colour.
  Typography: Crimson Pro for headings, IBM Plex Sans for data.

1. /entities/page.tsx — Entity Overview (VC/Registrar)
   CONSOLIDATED HEADER CARD:
     Institution name | Total ACTIVE (billable) students: 12,450
     Stacked bar chart by entity (recharts BarChart, colour per entity)
   ENTITY CARDS GRID (2-col desktop, 1-col mobile):
     Each card: entity type icon, name, type badge (colour-coded),
     coupling badge (INTERNAL=green, PARTIAL=amber, EXTERNAL=red/gray),
     billing badge (BILLED_TO_PARENT | BILLED_INDEPENDENTLY | EXEMPT),
     ACTIVE STUDENTS: [N] (large amber number — this is the billable count),
     INACTIVE STUDENTS: [N] (small gray),
     status chip (ACTIVE | SUSPENDED | PROVISIONING),
     "Manage" button
   "Add Entity" button → /entities/new

2. /entities/new/page.tsx — Create Entity Wizard
   Step 1: Entity type selection
     Visual cards for each EntityType with title, description, example institutions
     Coupling and billing auto-suggested based on type (overridable)
   Step 2: Basic details
     Name, short name, code, description, location, logo upload, colour picker
     Custom domain (optional)
   Step 3: Academic configuration (or inherit from institution)
     Grading system, semester type, student number format, academic calendar
   Step 4: Module selection
     Toggle cards for each module (pre-checked based on entity type defaults)
   Step 5: Review + Create
     Summary of all choices. "Confirm and Create" button.
     After click: full-page provisioning spinner with progress messages
     ("Creating entity structure...", "Setting up positions...", "Configuring workflows...")
     Poll GET /institution-entities/:id every 3 seconds until status: ACTIVE
     On ACTIVE: success toast + redirect to /entities/[id]

3. /entities/[id]/page.tsx — Entity Detail
   Tabs: Overview | Students | Staff | Billing | Modules | Settings | Danger Zone
   BILLING TAB:
     Active (billable) count TODAY: [N] — from latest DailyBillableSnapshot
     Inactive count: [N]
     30-day trend (line chart — recharts LineChart)
     Current billing model badge
     "View Draft Invoice" button (when available)
     Entity billing type: BILLED_TO_PARENT / BILLED_INDEPENDENTLY / EXEMPT

4. ENTITY SWITCHER COMPONENT
   File: apps/web/src/components/layout/entity-switcher.tsx
   Location: in the main layout sidebar, below the institution logo

   Collapsed: current entity logo + short name + type badge + chevron icon
   Expanded (Framer Motion dropDown):
     Institution-wide users: "All Entities" option at top (shows aggregate view)
     Entity list: each row = entity logo | name | type badge | ACTIVE count (amber)
   On select: POST /auth/switch-entity → invalidate TanStack Query cache → reload
   Active entity highlighted with left border accent

5. CONSOLIDATED DASHBOARD UPDATE (/dashboard/page.tsx)
   For entityScope: ALL users:
     Greeting: "Good morning, Professor [name] — viewing: All Entities"
     KPI cards each show: total value + "per entity" breakdown on hover (Tooltip)
     Active students card: "12,450 total" → hover → entity breakdown list
     Recent activity feed: each item has entity colour dot
```

---

# ════════════════════════════════════════════════════

# PHASE 3 — ORG STRUCTURE & POSITIONS

# Week 3 | [AGENT B] + [AGENT C]

# ════════════════════════════════════════════════════

## Prompt 3.1 — Org Structure Backend

```
[AGENT B — Claude Sonnet 4]

Build apps/api/src/modules/org-structure/.
All OrgUnit and Position records are dual-scoped (institutionId + entityId).
An OrgUnit belongs to exactly ONE entity. It never spans entities.
A Position is always within one entity.
Institution-wide positions (VC, Registrar) belong to the MAIN_CAMPUS entity
but have entityScope: ALL in their JWT.

OrgUnitsModule:
  CRUD for OrgUnit within an entity
  GET /org-units/tree?entityId=X → nested tree structure for one entity
  GET /org-units/institution-tree → all entities' trees (entityScope: ALL only)
    Returns: [{ entity: {id, name, type}, tree: OrgUnit[] }]
  Validation: cannot delete OrgUnit with active members or active child units

PositionsModule:
  CRUD for Position definitions within an entity
  GET /positions → all positions with current holder info
  GET /positions/vacant → positions with no current active holder
  POST /positions/:id/appoint → create PositionHolder
    Validates: higher-level position can appoint lower (VC appoints Deans,
    Deans appoint HoDs, etc.)
  POST /positions/:id/handover → end current holder, set new one
  POST /positions/:id/delegate → create acting appointment with endDate
  isUnique positions: validate no two concurrent active holders

PermissionBundlesModule:
  Default bundles seeded on institution creation:
    STUDENTS_FULL, STUDENTS_VIEW, STUDENTS_ADMIT
    STUDENTS_INACTIVATE, STUDENTS_REACTIVATE, STUDENTS_DELETE
    STUDENTS_BACKFILL (submit backfill requests)
    GRADES_ENTER, GRADES_APPROVE, GRADES_OVERRIDE
    ENROLLMENT_MANAGE, ENROLLMENT_VIEW
    FINANCE_FULL, FINANCE_VIEW, FINANCE_APPROVE
    BILLING_VIEW, BILLING_DISPUTE
    BILLING_SNAPSHOT_AMEND (UniCore super admin ONLY — not in default bundles)
    CURRICULUM_MANAGE, COURSES_CREATE
    STAFF_MANAGE, STAFF_VIEW, STAFF_APPRAISE
    REPORTS_INSTITUTION, REPORTS_ENTITY, REPORTS_DEPARTMENT
    SYSTEM_CONFIG, MODULES_MANAGE
    ELECTIONS_MANAGE, MEETINGS_CONVENE
    ALUMNI_MANAGE, SPORTS_MANAGE

OrgTemplatesModule:
  Entity-type-specific OrgUnit tree templates
  POST /org-templates/apply-to-entity { entityId, template }
    Creates all OrgUnit nodes and Position definitions for that entity type
  Applied automatically during EntityProvisioningJob
```

## Prompt 3.2 — Org Chart UI

```
[AGENT C — GPT-4o]

Build org structure UI in apps/web.

1. /settings/org-structure/page.tsx
   For entityScope: ALL users: entity tabs at top (All | Main Campus | Extramural | ...)
   "All Entities" tab shows mini org chart per entity side by side
   Per-entity tab: full ReactFlow org chart (@xyflow/react)
     Node colours by OrgUnitType:
       FACULTY=navy, DEPARTMENT=teal, PROGRAMME=green,
       ADMIN_UNIT=amber, COMMITTEE=purple
     Each node: unit name, type badge, head name + position title
     Click node → side panel: unit details + current position holders
     Drag to rearrange (updates order — aesthetic only)
     Toolbar: zoom controls, fit view, export PNG

2. /settings/positions/page.tsx
   TanStack Table: title, entity badge, org unit, level badge (1–7 colour gradient),
   current holder name, start date, "Appoint" / "Handover" / "Delegate" buttons
   "VACANT" amber badge for positions with no current holder
   Filter: by entity (ALL-scope users), by level, by vacancy status
   "Appoint" → inline modal: search user → select → set start date → confirm
```

---

# ════════════════════════════════════════════════════

# PHASE 4 — WORKFLOW ENGINE

# Week 3–4 | [AGENT A] + [AGENT B] + [AGENT C]

# ════════════════════════════════════════════════════

## Prompt 4.1 — Workflow Engine Backend

```
[AGENT A — Claude Opus 4]

Build the WorkflowEngine in apps/api/src/modules/workflow-engine/.
Every multi-step approval in the system runs through this engine.
No module implements its own approval logic.

WORKFLOW SCOPE:
  ENTITY:       all steps within one entity (most workflows)
  INSTITUTION:  some steps require institution-level positions (VC, Registrar)
  CROSS_ENTITY: involves multiple entities (student transfer, inter-entity enrollment)

CORE SERVICE — WorkflowEngineService:

initiateWorkflow(dto):
  { institutionId, entityId, definitionCode, entityType, entityId_record,
    initiatedBy (userId), metadata? }
  Find active WorkflowDefinition (entity-specific first, then institution template)
  Create WorkflowInstance at step 1
  Resolve step 1 assignee: find PositionHolder matching step's assignedTo config
    For INSTITUTION-scope steps: find holder in MAIN_CAMPUS with entityScope: ALL
  Set dueAt = now + step.slaHours
  Notify assignee (NotificationService)
  Return created instance

processStep(dto):
  { instanceId, actorId, action (APPROVE|REJECT|REQUEST_INFO|ESCALATE), notes?, additionalData? }
  Validate actor IS the current step's assignee (or delegation covers it)
  Validate actor's entityId + scope matches step requirements
  Record in history[]
  APPROVE + more steps → advance, notify next assignee, reset dueAt
  APPROVE + last step → status APPROVED, emit 'workflow.completed:{code}'
  REJECT → status REJECTED, emit 'workflow.rejected:{code}'
  REQUEST_INFO → status unchanged, notify initiator
  ESCALATE → assign to escalation position, update dueAt

checkSlaBreaches(): [BullMQ cron every hour]
  Find instances where dueAt < now AND status IN_PROGRESS
  Auto-escalate current step to escalation position
  Notify both original assignee and supervisor
  Log SLA breach in AuditLog

SEED THESE WorkflowDefinitions (via seed file):

STUDENT_INACTIVATION (ENTITY scope):
  Step 1: Entity Registrar (initiates + selects sub-reason + justification)
  System: immediate logout + read-only enforcement + billingImplication: LOSS

STUDENT_REACTIVATION (ENTITY scope):
  Step 1: HoD (recommend, 48h SLA)
  Step 2: Dean (endorse, 48h SLA)
  Step 3: Entity Registrar (confirm + set effective date, 24h SLA)
  → 'workflow.completed:STUDENT_REACTIVATION' → StatusChangeService.changeStatus(ACTIVE)

BACKFILL_REQUEST (ENTITY + Finance step):
  Step 1: HoD (review academic justification, 72h SLA)
  Step 2: Dean (approve, 72h SLA)
  Step 3: Entity Registrar (final approval, 48h SLA)
  Step 4: Finance (generate retroactive invoice, 48h SLA) [INSTITUTION scope step]
  → 'workflow.completed:BACKFILL_REQUEST' → BackfillRequestService.onBackfillApproved()

STUDENT_PERMANENT_DELETION (INSTITUTION scope):
  Step 1: Registrar (initiate + typed confirmation: studentNumber, 0h SLA)
  Step 2: Deputy VC (approve, 72h SLA)
  Step 3: Finance (confirm outstanding balance = 0, 48h SLA)
  → 'workflow.completed:STUDENT_PERMANENT_DELETION' → StudentDeletionService.execute()

STUDENT_TRANSFER (CROSS_ENTITY scope):
  Step 1: Source Entity Registrar (initiate + reason)
  Step 2: Dest Entity Registrar (accept, 72h SLA)
  Step 3: Institution Registrar (log, 24h SLA) [INSTITUTION scope step]
  → 'workflow.completed:STUDENT_TRANSFER' → executeTransfer():
     Update Student.entityId + User.entityId
     Status stays ACTIVE — no billing gap, no records gap
     Create StudentTransferRecord

GRADE_OVERRIDE (ENTITY scope):
  Student → Lecturer (comments, 24h) → HoD (approve/reject, 48h) →
  Dean (if > 10 points, 72h) → Entity Registrar (execute, 24h)

GRADUATION_CLEARANCE (INSTITUTION scope):
  Programme Coord → HoD → Dean → Entity Registrar →
  Finance → Library → VC/Institution Registrar

COURSE_CREATION: Lecturer → HoD → Dean → Academic Board → Entity Registrar
BUDGET_REQUEST: Unit Head → Entity Director → Entity Finance → Inst. Finance Director
SCHOLARSHIP_AWARD: Committee → Finance Director → Deputy VC → Inst. Registrar
LEAVE_REQUEST: Staff → Line Manager → HoD → HR Director
GRADE_SUBMISSION: Lecturer → HoD → Dean → Entity Registrar (publish)
AFFILIATE_LINK: Entity Admin (request) → Institution VC/Registrar (approve)

EVENT LISTENERS (in relevant modules):
  'workflow.completed:STUDENT_REACTIVATION' → StatusChangeService.changeStatus()
  'workflow.completed:BACKFILL_REQUEST' → BackfillRequestService.onBackfillApproved()
  'workflow.completed:STUDENT_PERMANENT_DELETION' → StudentDeletionService.execute()
  'workflow.completed:STUDENT_TRANSFER' → executeTransfer()
  'workflow.completed:GRADUATION_CLEARANCE' → ClearanceService.markCleared()
  'workflow.rejected:*' → NotificationService.notifyRejection()

SLA MONITOR: BullMQ cron hourly → checkSlaBreaches()
```

## Prompt 4.2 — Workflow Inbox UI

```
[AGENT C — GPT-4o]

Build workflow pages in apps/web.

Design: Clean, information-dense. SLA countdown urgency: green > amber > red.
Entity badge on every workflow card showing which entity it belongs to.

1. /workflow/inbox/page.tsx — My Pending Actions
   List of WorkflowInstances where current step is assigned to user's position
   Card layout per instance:
     Left: workflow type badge (colour per type), entity badge,
           entity name + student name/number (if student-related)
     Center: step name, "Assigned to: [your position]", initiated by + when
     Right: SLA countdown (green if >24h, amber if 6–24h, red if <6h)
            "Review & Act" button
   Filter: by workflow type, by urgency
   Institution-wide users: "All Entities" tab + entity filter tabs
   CROSS_ENTITY workflows: special badge "Cross-Entity" in orange

2. /workflow/initiated/page.tsx — Requests I Started
   Progress stepper per instance showing current step
   Status badge: IN_PROGRESS | APPROVED | REJECTED | ESCALATED | CANCELLED
   Click → full detail view

3. /workflow/[instanceId]/page.tsx — Review & Act
   LEFT PANEL: Entity context ("This action is in: [Entity Name]")
     For CROSS_ENTITY: both entities shown with arrow between them
     Entity detail card with relevant record info
       (for STUDENT_REACTIVATION: student profile summary + status history)
       (for BACKFILL_REQUEST: period dates + billing impact + justification)
       (for GRADE_OVERRIDE: original grade + requested grade + reason)
   CENTER PANEL: Decision
     Current step indicator (step N of M)
     Action buttons: APPROVE | REJECT | REQUEST_INFO | ESCALATE
     Notes textarea (required for REJECT and REQUEST_INFO)
     Additional fields from step.requiredFields config
     SLA warning banner if dueAt < 6 hours
   RIGHT PANEL: History Timeline
     Each step: position title, entity label, action badge, notes, timestamp
     Current step highlighted with pulsing indicator

4. /workflow/overview/page.tsx — Manager's View (Level 1–4 positions)
   All instances within their scope grouped by status
   SLA breach rate chart (recharts)
   Average resolution time by workflow type
```

---

# ════════════════════════════════════════════════════

# PHASE 5 — BILLING ENGINE

# Week 3–4 | [AGENT A] + [AGENT B] + [AGENT C]

# ════════════════════════════════════════════════════

## Prompt 5.1 — Billing Snapshot & Invoice Services

```
[AGENT B — Claude Sonnet 4]

Build apps/api/src/modules/billing/.
This is the revenue engine. Build it with precision.

BillingSnapshotService:

computeDailySnapshot(institutionId, entityId, date):
  billableCount = await this.prisma.student.count({
    where: {
      institutionId,
      entityId,
      enrollmentStatus: 'ACTIVE',
      deletedAt: null
    }
  })
  await this.prisma.dailyBillableSnapshot.upsert({
    where: { institutionId_entityId_snapshotDate: { institutionId, entityId, snapshotDate: date } },
    create: { institutionId, entityId, snapshotDate: date, billableCount },
    update: {}   ← write-once: upsert does nothing if record exists
  })
  If billableCount changes > 10% from yesterday: emit 'billing.anomaly' alert
  Update Institution.currentStudentCount = SUM across all entities

runDailySnapshots(): [BullMQ cron: '0 2 * * *']
  For each ACTIVE institution:
    Get all ACTIVE entities
    await Promise.all(entities.map(e => computeDailySnapshot(inst.id, e.id, today)))
  Job config: attempts: 3, backoff: exponential 5000ms
  On all retries exhausted: emit CRITICAL alert to UniCore ops team

computeMonthlyBillable(institutionId, entityId, month, year):
  Fetch all DailyBillableSnapshot for that month + entity
  peakDailyCount = MAX(all billableCount values)
  averageDailyCount = MEAN(all billableCount values, rounded to 4 decimal places)
  watermarkCount = MAX(peak, average) → rounded UP to nearest integer
  Upsert MonthlyBillableSummary
  Return watermarkCount

BillingInvoiceService:

generateDraftInvoice(institutionId, billingMonth, billingYear):
  For each entity (parallel):
    If EXEMPT: skip
    summary = computeMonthlyBillable(...)
    Apply billing model:
      MONTHLY_WATERMARK: watermarkCount × perStudentMonthlyFee
      ANNUAL_PEAK: only at year end — skip for monthly runs
      SEMESTER_HEADCOUNT: count on Semester.censusDate for active semester
    Apply minimum commitment:
      count = MAX(watermarkCount, institution.minimumBillableCount)
    Classify: BILLED_TO_PARENT vs BILLED_INDEPENDENTLY
  Build lineItems: [{description, entityId, entityName, count, unitFee, subtotal}]
  Generate BillingEvidence JSON → upload to S3 → store evidenceS3Key
  Create Invoice (status: DRAFT, isRetroactive: false)
  Schedule LockInvoiceJob (BullMQ delayed, fires after disputeWindowDays)
  Notify institution: "Draft invoice ready. Dispute window open until [date]."

generateRetroactiveInvoice(backfillRequestId):
  Get BackfillRequest + approved period dates
  monthsInPeriod = CEIL(daysDiff(toDate, fromDate) / 30)
  amount = monthsInPeriod × perStudentMonthlyFee
  Create Invoice (status: OPEN, isRetroactive: true, backfillRequestId)
  Lock immediately (no dispute window for retroactive invoices)
  Trigger Stripe payment

lockInvoice(invoiceId):
  Validate disputeWindowDays have elapsed OR no pending disputes
  Set Invoice.lockedAt = now()
  Set relevant DailyBillableSnapshot.isLockedForBilling = true (for that period)
  Trigger Stripe payment intent
  Emit 'invoice.locked'

BillingDisputeService:
  initiateDispute(dto: { invoiceId, disputedStudentIds[], reason }):
    Validate Invoice.status = DRAFT (dispute window open)
    Validate disputedStudentIds appear in Invoice's BillingEvidence
    Create BillingDispute record
    Auto-validate each disputed student:
      For each studentId:
        wasActive = was student ACTIVE for any day in billing period?
        (Check DailyBillableSnapshot for period — student appears if active that day)
        outcome = wasActive ? 'REJECT_DISPUTE' : 'ACCEPT_DISPUTE'
    If ALL accepted → auto-resolve, remove from invoice, generate amended invoice
    If ANY rejected → status MANUAL_REVIEW → notify UniCore billing team

  resolveDispute(disputeId, resolution, notes): [UniCore super admin only]
    ACCEPT: recompute invoice total, set billableAdjustment, create amended invoice
    REJECT: maintain original invoice total
    Notify institution of resolution

BullMQ JOBS:
  daily-snapshot.processor.ts:   cron '0 2 * * *'
                                   jobId: 'daily-snap-{inst}-{entity}-{date}' (deduplication)
  monthly-billing.processor.ts:  cron per Institution.billingDayOfMonth
                                   jobId: 'monthly-{inst}-{month}-{year}' (deduplication)
  lock-invoice.processor.ts:     delayed job, triggered after dispute window
  retroactive-billing.processor.ts: triggered by BackfillRequest approval workflow

CONTROLLER:
  GET /billing/snapshots        institution reads their own snapshots (read-only)
  GET /billing/summary/:month/:year  monthly billable summary per entity
  GET /billing/invoices         invoice list
  GET /billing/invoices/:id     invoice detail + evidence download link
  POST /billing/disputes        initiate dispute (institution)
  GET /billing/disputes         dispute list + status

SUPER ADMIN ONLY:
  PATCH /super-admin/billing/snapshots/:id  amend snapshot (mandatory reason)
  GET /super-admin/billing/disputes         all pending disputes
  POST /super-admin/billing/disputes/:id/resolve  resolve dispute
```

## Prompt 5.2 — Status Change & Backfill Services

```
[AGENT B — Claude Sonnet 4]

Build student status management services.
These are the most billing-critical services in the system.

StatusChangeService (apps/api/src/modules/students/status/):

changeStatus(dto):
  { studentId, institutionId, entityId,
    toStatus, toInactiveReason?,
    reason (mandatory, non-empty),
    reasonCategory, effectiveDate,
    supportingDocKey?, changedBy, changedByPosition,
    workflowInstanceId? }

  STEP 1 — Validate transition (see .cursorrules Section 6.4)
  STEP 2 — Validate actor authority per position + permission
  STEP 3 — Compute billingImplication:
    INACTIVE → ACTIVE:  GAIN
    ACTIVE → INACTIVE:  LOSS
    INACTIVE → INACTIVE (sub-reason only): NONE
  STEP 4 — Execute in Prisma $transaction:
    a) prisma.statusChangeLog.create(...)  ← IMMUTABLE, no update ever
    b) prisma.student.update({ enrollmentStatus, inactiveReason, inactiveSince })
       This is the ONLY place Student.enrollmentStatus is written
    c) IF going INACTIVE:
       await this.authService.InvalidateStudentSessions(student.userId, institutionId)
       ← SYNCHRONOUS within transaction — not a background job
    d) AuditLogService.log({ ..., billingImplication })
    e) emit('student.status.changed', { studentId, billingImplication })
  STEP 5 — Post-transaction:
    IF going INACTIVE: emit WebSocket 'session.terminated' to user:{userId}
    Send notification to student
    Send notification to entity Registrar

getStatusHistory(studentId): StatusChangeLog[] ordered by effectiveDate DESC

getBillingImpactReport(institutionId, entityId?, fromDate, toDate):
  All GAIN and LOSS changes in range
  Per-entity breakdown with cumulative count change
  Used by Finance Director and VC for reconciliation

BackfillRequestService (apps/api/src/modules/students/backfill/):

estimateRetroactiveFee(studentId, fromDate, toDate, institutionId):
  daysInPeriod = diff(toDate, fromDate) in days
  monthsInPeriod = CEIL(daysInPeriod / 30)
  return { monthsInPeriod, estimatedFee, currency }

submitBackfillRequest(dto):
  Validate: student.enrollmentStatus == INACTIVE (or was INACTIVE in specified period)
  Validate: no overlapping approved BackfillRequest exists
  Compute estimatedRetroactiveFee
  Validate: dto.billingAcknowledged === true
    If false: throw BadRequestException({
      message: 'You must acknowledge the billing consequence before submitting.',
      estimatedFee, currency, monthsInPeriod
    })
  Create BackfillRequest
  Initiate WorkflowEngine: BACKFILL_REQUEST
  Return { request, workflow }

onBackfillApproved(workflowInstanceId): [called by workflow.completed event]
  Get BackfillRequest
  Create BackfillWindow { studentId, fromDate, toDate, isActive: true }
  Schedule BackfillWindowExpiryJob (BullMQ delayed, fires at toDate):
    Set BackfillWindow.isActive = false
  Dispatch RetroactiveBillingJob (BullMQ) → generates retroactive invoice
  Update BackfillRequest.status = APPROVED
  Notify institution: "Backfill approved. Records can now be posted for [fromDate]–[toDate].
    A retroactive invoice of $X is being generated."

StudentDeletionService:

execute(workflowInstanceId): [called by workflow.completed event]
  Get workflow → get studentId
  Final checks: balance = 0, no active workflows
  Anonymise student record:
    Student.profile = { firstName: 'REDACTED', lastName: 'REDACTED', ...anonymised fields }
    (studentNumber retained for statistics)
  Anonymise all related personal records (transcripts, documents, etc.)
  Delete User record HARD (auth user hard-deleted)
  Update Student.enrollmentStatus = PERMANENTLY_DELETED
  Create AuditLog (immutable record of the deletion event)
  Return { anonymisedStudentId, studentNumber }
```

## Prompt 5.3 — Billing Dashboard UI

```
[AGENT C — GPT-4o]

Build billing pages in apps/web. Financial precision UI.
Monospace for all numbers. Green for ACTIVE. Gray for INACTIVE. Amber for attention.

1. /billing/page.tsx — Billing Overview
   SNAPSHOT CARD (most prominent on page):
     "Active Students (Billable) Today"
     Large monospace number: 8,450
     vs yesterday: ↑ 12 students
     vs same day last month: ↑ 142 (1.7%)
     Entity breakdown (collapsible): Main: 6,200 | Extramural: 1,800 | DL: 450
   INACTIVE STUDENTS CARD:
     1,234 inactive (DEFERRED: 456 | GRADUATED: 389 | WITHDRAWN: 201 | ...)
     "These students are not billed"
   CURRENT INVOICE STATUS:
     If draft: "Draft invoice ready — [N] days to dispute" + countdown
     If locked: "Invoice locked — payment processing"
     If paid: "Latest invoice: $X paid on [date]"
   30-DAY TREND CHART:
     recharts LineChart: one line per entity (different colour)
     Label: "This chart determines your monthly bill"
     Tooltip on hover: date + count per entity

2. /billing/snapshot/page.tsx — Daily Snapshot History
   Description: "This is your institution's daily active student count as
   computed by UniCore. These numbers form the basis of your invoice."
   TanStack Table: date, count per entity, total, any amendments noted
   Export to CSV button

3. /billing/invoice/[id]/page.tsx — Invoice Detail + Dispute Interface
   Invoice header: period, total amount, status badge
   Entity breakdown table: entity name, count, unit fee, subtotal
   If RETROACTIVE: orange banner "RETROACTIVE INVOICE — Backfill Approved"
   STUDENT BREAKDOWN (paginated TanStack Table):
     studentNumber | entity | status | days active | "Dispute" checkbox
   "Dispute Selected Students" button (only in DRAFT status, dispute window open)
   Dispute modal: reason text + upload supporting doc + submit

4. /billing/disputes/page.tsx — Dispute Tracker
   List of all submitted disputes with status chips
   Auto-validation result expandable per dispute:
     "Student X: was ACTIVE on 3 days during disputed period → dispute rejected"
     "Student Y: was INACTIVE entire period → dispute accepted"
   Pending manual review: "UniCore billing team reviewing — SLA 3 business days"

5. STUDENT PROFILE — STATUS UI (critical)
   apps/web/src/components/students/status/inactive-banner.tsx:
     Full-width amber banner at top of student profile:
     "⚠ INACTIVE STUDENT — [InactiveReason] since [date]"
     "This student is not billable. No records may be posted."
     Action buttons (based on user position + permission):
       "Initiate Reactivation" (requires STUDENTS_REACTIVATE)
       "Submit Backfill Request" (requires STUDENTS_BACKFILL)
       "Initiate Permanent Deletion" (requires STUDENTS_DELETE + preconditions)
     ALL form inputs on the page: disabled={true}
     ALL action buttons (save, submit, add, enroll): hidden or disabled

   apps/web/src/components/students/status/status-timeline.tsx:
     Vertical timeline, most recent at top
     Each entry:
       Date + time (exact: "15 Nov 2024, 09:32")
       Transition: [ACTIVE] → [INACTIVE] (colour-coded pills)
       InactiveReason badge if applicable
       Reason text + reasonCategory chip
       Changed by: position title
       billingImplication icon + label
       Supporting document link (if any)
       isBackfilled indicator (if this change relates to a backfill)
     Framer Motion staggered entry animation

SUPER ADMIN BILLING pages (apps/admin):

6. admin /billing/page.tsx — Platform Revenue
   Total MRR + platform-wide active student count
   Per-institution table: name, billing model, active today, monthly invoice, dispute count
   ANOMALY ALERTS: institutions where count dropped >10% in 7 days (red row highlight)
   "Review" link per institution → /institutions/[id]/billing

7. admin /billing/disputes/[id]/page.tsx — Dispute Resolution
   Student status history since billing period start
   Auto-validation results (clear ACCEPT/REJECT per student with reason)
   ACCEPT all / REJECT all / Review individually
   "Accept" button: "This will reduce the invoice by $X for [N] students"
   Resolution notes textarea (required)
   After resolution: amended invoice generated + institution notified
```

---

# ════════════════════════════════════════════════════

# PHASE 6 — SUPER ADMIN PLATFORM MANAGEMENT

# Week 4–5 | [AGENT B] + [AGENT C]

# ════════════════════════════════════════════════════

## Prompt 6.1 — Super Admin Backend

```
[AGENT B — Claude Sonnet 4]

Build super admin modules. These are PLATFORM-level — no entityId filter.
All endpoints protected by SuperAdminGuard.

InstitutionsModule (apps/api/src/modules/institutions/):
  POST /super-admin/institutions → create + provision:
    a) Create Institution record
    b) Create MAIN_CAMPUS InstitutionEntity (status: PROVISIONING)
    c) Dispatch EntityProvisioningJob
    d) Create VC User (entityScope: ALL)
    e) Create Subscription
    f) Queue welcome email (BullMQ)
  GET /super-admin/institutions → paginated list with health scores + entity count
  GET /super-admin/institutions/:id → detail + all entities + billing config
  PATCH /super-admin/institutions/:id → update plan, billing config, status
  POST /super-admin/institutions/:id/suspend → revoke all sessions + set SUSPENDED
  POST /super-admin/institutions/:id/activate

  InstitutionHealthService:
    healthScore = paymentStatus(30%) + loginActivity(30%) + featureUsage(20%) + dataCompleteness(20%)
    Updated daily via BullMQ cron

SubscriptionsModule:
  Stripe integration: customer, subscription, invoice webhooks
  Per-institution + per BILLED_INDEPENDENTLY entity billing
  Auto-suspend after payment failure + 14-day grace period
  Upgrade/downgrade plan

MonitoringModule:
  GET /super-admin/monitoring → all institutions with health scores + active student counts
  GET /super-admin/monitoring/:id → time-series usage per entity
  GET /super-admin/monitoring/:id/audit-log → full audit log
  WebSocket gateway: real-time active session counts per institution
  Anomaly feed: institutions with >10% student count drop in 7 days

FeatureFlagsModule:
  Global flags (apply to all) + per-institution overrides
  Percentage rollout (e.g. 10% of institutions see a new feature)

BillingAdminModule:
  GET /super-admin/billing/disputes → all pending manual review disputes
  POST /super-admin/billing/disputes/:id/resolve → resolve dispute
  PATCH /super-admin/billing/snapshots/:id → amend snapshot (mandatory reason)
  GET /super-admin/billing/institution/:id/snapshots → institution's snapshot history
  POST /super-admin/billing/institution/:id/generate-invoice → manual invoice trigger
```

## Prompt 6.2 — Super Admin Frontend

```
[AGENT C — GPT-4o]

Build apps/admin — the UniCore super admin portal.

Design: Bloomberg Terminal meets Vercel Dashboard.
Dark theme: #0a0a0a background, #111111 cards, #2563eb electric blue accent.
Monospace for all numerical data. Dense information architecture.
Font: JetBrains Mono for data, Geist Sans for UI.

1. /dashboard — Platform Overview
   KPI cards (monospace numbers):
     Total Institutions | Total Active Students (billable) | Platform MRR
     Open Disputes | System Health Score
   MRR trend chart (recharts LineChart, last 12 months)
   World map (react-simple-maps): institution pins, colour by plan
   Recent events feed: new sign-ups, suspensions, payments, anomalies
   Active session count (real-time WebSocket): "N users online now"

2. /institutions — Institutions Table
   TanStack Table with: search, filter (plan, status, country, type)
   Columns: logo+name, plan badge, ACTIVE students/max (progress bar),
   health score ring (0–100), monthly invoice, dispute count,
   last login activity, status chip, actions menu
   Expandable row: all entities with their individual active counts
   Bulk actions: suspend, export CSV

3. /institutions/new — Onboarding Wizard (5 steps)
   Step 1: Institution details
   Step 2: Billing configuration (plan, model, perStudentFee, minimumCount)
   Step 3: Admin user creation (becomes VC with entityScope: ALL)
   Step 4: Initial module selection
   Step 5: Review → Create → provision spinner

4. /institutions/[id] — Institution Detail
   Tabs: Overview | Entities | Billing | Modules | Subscription | Audit Log | Danger Zone
   ENTITIES TAB:
     All entities with type, coupling, billing, ACTIVE count, status
     "Add Entity" button
     Entity active student chart (bar chart — recharts)
   BILLING TAB:
     Billing model config (editable by super admin)
     30-day snapshot chart per entity
     All invoices + dispute status
     "Amend Snapshot" button (opens modal requiring mandatory reason)
     "Generate Invoice" button (manual trigger)
   DANGER ZONE:
     Suspend institution (typed confirmation: institution slug)
     Terminate (typed slug + additional confirmation)

5. /billing/disputes — Dispute Resolution Queue
   Table: institution, invoice period, disputed students, status, SLA
   Filter: PENDING | AUTO_VALIDATED | MANUAL_REVIEW
   Click → full resolution interface
```

---

# ════════════════════════════════════════════════════

# PHASE 7 — STUDENT INFORMATION SYSTEM (SIS)

# Week 5–7 | [AGENT B] + [AGENT C]

# ════════════════════════════════════════════════════

## Prompt 7.1 — SIS Backend

```
[AGENT B — Claude Sonnet 4]

Build all SIS NestJS modules. All dual-scoped. All student-write endpoints
use StudentRecordPostingGuard. Status changes ONLY via StatusChangeService.

StudentsModule:
  Student CRUD — reads open to authorised positions, writes guarded
  Student number auto-generation: institution setting 'studentNumberFormat'
    Format parser: "YYYY/[ENTITY_CODE]/[SEQ:5]" → "2024/MAIN/00042"
    Sequence is per-institution (unique across all entities)
  Bulk CSV import: BullMQ job (validate → transform → create User+Student)
  Student search: PostgreSQL full-text (tsvector on name, studentNumber, email)
  Computed fields in response:
    currentGPA (computed from StudentEnrollments)
    creditHoursCompleted (sum of completed CourseEnrollments × creditHours)
    academicStanding (GOOD|PROBATION|SUSPENSION based on institution GPA thresholds)
  Graduation confirmation endpoint:
    POST /students/:id/confirm-graduation
    Requires STUDENTS_GRADUATE permission
    Sets Student.graduationConfirmedAt = now()
    Calls StatusChangeService.changeStatus(INACTIVE, GRADUATED)
    Instant logout triggered by StatusChangeService
    Billing stops from this moment

AdmissionsModule:
  Dynamic application forms (render JSON schema on frontend)
  Application workflow with configurable stages
  Document upload via presigned S3 URLs
  Offer letter generation: Handlebars template → puppeteer PDF → S3
  Offer acceptance → create User + Student + trigger enrollment

EnrollmentModule:
  Course registration: validate prerequisites, check holds, check capacity
  Registration period enforcement (Semester.registrationOpen/Close)
  Waitlist: auto-promote when enrolled student drops
  Drop/Add: enforce Semester deadline
  EnrollmentHold: FINANCIAL|ACADEMIC|ADMINISTRATIVE|LIBRARY|DISCIPLINARY
    Hold placement/lifting: does NOT change enrollmentStatus (separate from billing)
    Hold blocks registration of new courses but student remains ACTIVE (billable)
  Mass enrollment from CSV (BullMQ)
  Timetable conflict detection before confirming enrollment
  Inter-entity enrollment: validate SharedCourse exists for student's entity

GradesModule:
  Grade entry by Lecturer (their sections only — ScopeGuard enforced)
  Assessment component weights (configurable per section)
  Automatic letterGrade + gradePoints from entity's GradingScale
  GPA calculation: per-semester + cumulative (CGPA)
  Grade submission workflow (WorkflowEngine: GRADE_SUBMISSION)
  Grade release: ONLY after Dean approval + Registrar publish
  Grade override workflow (WorkflowEngine: GRADE_OVERRIDE)
  Transcript compilation: full academic history across ALL entities →
    JSON → puppeteer PDF → S3
    Each semester labeled with the entity it was earned in
    Example: "Semester 1 2022/23 — Main Campus | Semester 3 2023/24 — Extramural"

AttendanceModule:
  Session management: create session → generate QR (expires after class duration)
  QR attendance: student scans → validate code + not expired → create AttendanceRecord
  Manual marking: Lecturer marks individual students
  Attendance stats: per-student per-section percentage
  Below-threshold alert: < 75% → emit event → AI risk flagging
  Offline sync: bulk mark endpoint for PWA offline data

DocumentsModule:
  Document request workflow
  Template-based generation: fetch Handlebars HTML from S3 → compile →
    puppeteer → PDF → upload S3 → create Document record
  Verification endpoint: GET /verify/:verificationCode (PUBLIC, no auth)
    Returns: { valid, documentType, issuedDate, institution, isRevoked }
    QR code on document links to this endpoint
  Clearance workflow (WorkflowEngine: GRADUATION_CLEARANCE)

KEY RULE FOR ALL STUDENT WRITE ENDPOINTS:
  @UseGuards(JwtAuthGuard, EntityScopeGuard, StudentRecordPostingGuard)
  All records posted via approved BackfillWindow:
    Use request.backfillContext from guard to set isBackfilled: true + backfillRequestId
```

## Prompt 7.2 — SIS Frontend

```
[AGENT C — GPT-4o]

Build SIS frontend. Entity-aware throughout. INACTIVE enforcement in UI.

Design: Premium academic aesthetic. Navy (#1e3a5f) navigation, white content,
amber accent (#f59e0b). Crimson Pro headings, IBM Plex Sans UI text.

1. /students/page.tsx — Student Registry
   Entity filter tabs for ALL-scope users: All | [per entity tab]
   Entity badge column on every student row (colour-coded)
   Advanced filters: programme, level, status, inactiveReason, entity, year
   TanStack Table:
     Photo+name | studentNumber | entity badge | programme | CGPA ring |
     status chip (ACTIVE=green, INACTIVE=amber/reason) | actions menu
   Bulk actions: export, message, view

2. /students/[id]/page.tsx — Student Profile
   HERO: photo, name, studentNumber, programme, entity badge
   Status badge: ACTIVE (green) or INACTIVE + reason (amber)
   If INACTIVE: <InactiveBanner> component fills the top of the page
     All form fields disabled, all action buttons hidden
   If isBackfilled records exist: "Some records are backfilled" notice

   TABS: Overview | Academic | Financial | Documents | Attendance | Status | Notes

   OVERVIEW: personal info, guardians, enrollment timeline, current courses
   ACADEMIC: CGPA trend chart (recharts), credit progress ring,
             semester-by-semester grade history, graduation progress checklist,
             What-if calculator (client-side)
   FINANCIAL: balance card, transactions, payment plan progress
   DOCUMENTS: issued docs list, request new document button
   ATTENDANCE: per-section percentage bars, calendar heatmap
   STATUS TAB: <StatusTimeline> component (full change history)
     "Change Status" button (requires STUDENTS_INACTIVATE permission)
       → StatusChangeModal (validated transitions, billing preview)
     "Submit Backfill Request" button (requires STUDENTS_BACKFILL)
       → BackfillModal (period picker, justification, billing acknowledgment)
   AI INSIGHTS panel (floating, collapsible):
     Risk level: LOW | MEDIUM | HIGH
     AI narrative on student's academic trajectory
     Suggested interventions

3. /admissions/page.tsx — Admissions Dashboard
   Funnel chart: Applied → Reviewed → Shortlisted → Accepted → Enrolled
   Kanban board: applications grouped by status, drag to change
   Application detail modal: submitted form, documents, decision panel + workflow trail

4. /enrollment/register/page.tsx — Course Registration (Student View)
   Course browser with search + filters
   Section details: Lecturer, schedule, seats remaining, room, mode
   Visual timetable conflict detection
   Course cart → "Confirm Registration"
   Real-time seat count via WebSocket

5. /grades/entry/page.tsx — Grade Entry (Faculty)
   Section selector → student list with inline grade cells
   Auto-calculation of weighted totals and letter grades
   Save draft vs Submit to HoD

6. /workflow/inbox/page.tsx — already built in Phase 4
```

---

# ════════════════════════════════════════════════════

# PHASE 8 — LEARNING MANAGEMENT SYSTEM (LMS)

# Week 7–9 | [AGENT B] + [AGENT C]

# ════════════════════════════════════════════════════

## Prompt 8.1 — LMS Backend

```
[AGENT B — Claude Sonnet 4]

Build LMS modules in apps/api/src/modules/lms/.
Student CANNOT access LMS while INACTIVE — enforce on all student-facing endpoints.
All submission endpoints: StudentRecordPostingGuard applied.

CourseBuilderModule:
  Course instance lifecycle: draft → published
  Module + Lesson CRUD with drag-to-reorder (bulk update order positions)
  Video upload: presigned S3 URL → client uploads → webhook → BullMQ transcode job
    (HLS adaptive bitrate via FFmpeg or AWS MediaConvert)
  SCORM 1.2/2004 package upload + runtime API
  AI content tools:
    POST /lms/lessons/:id/generate-summary → AI summarises lesson content
    POST /lms/assessments/:id/generate-questions → AI creates quiz questions
  Course clone: copy entire structure to new semester/section

AssessmentsModule:
  Question bank with tags and difficulty levels
  Quiz attempt engine:
    POST /attempts → create (validate max attempts, within dates)
    GET /attempts/:id → return questions (shuffled if configured)
    PATCH /attempts/:id/answer → save answer, validate timing
    POST /attempts/:id/submit → auto-grade MCQ/T-F, queue AI essay grading
  Assignment submission: file upload + rich text
  Rubric-based grading
  Peer review allocation (random assignment)
  Grade passback to SIS: update StudentEnrollment.grade after final grading
  AI essay feedback: draft feedback for faculty review before releasing

ProgressModule:
  POST /lms/lessons/:id/complete → update StudentProgress
  Heartbeat: PATCH /lms/sessions/heartbeat → track time-on-platform
  Completion certificates: generate PDF when progressPercent = 100
  All progress endpoints: StudentRecordPostingGuard

AIModule (in apps/api/src/modules/ai/ — see Phase 13):
  RAG pipeline: embed lesson content → pgvector → AI Tutor queries
  POST /ai/tutor/:courseInstanceId/message → SSE streaming response
```

## Prompt 8.2 — LMS Frontend

```
[AGENT C — GPT-4o]

Build LMS frontend. Modern EdTech aesthetic.
Dark navy (#0f1729) sidebar, white content area.
Each course gets a generated gradient based on department colour.
Font: Plus Jakarta Sans.

1. /lms/page.tsx — Course Dashboard (Student)
   Course cards: cover image, progress ring, Lecturer name,
   due-soon count, last accessed
   "Continue Learning" button deep-links to last lesson

2. /lms/[courseId]/page.tsx — Course Learning Experience
   Left sidebar: module tree with completion checkmarks, collapsible, sticky
   Main area: lesson viewer (type-specific rendering)
     VIDEO: HLS.js player, speed control, chapter markers, notes
     PDF: react-pdf viewer with zoom
     TEXT: beautiful typography, estimated read time
     QUIZ: full quiz engine with countdown timer (see quiz component)
   Right panel: AI Tutor (collapsible chat)
   Progress bar across top

3. Quiz Engine Component (apps/web/src/components/lms/quiz-engine/)
   Full-screen lock option
   Question navigator sidebar
   Flag/mark questions
   Countdown timer (synced with server)
   Auto-save every 30 seconds via WebSocket
   Submission confirmation with receipt

4. /teach/[courseId]/page.tsx — Course Builder (Faculty)
   Left: Module + Lesson tree with drag-and-drop (@dnd-kit)
   Center: Lesson editor (TipTap for text, upload for video/PDF)
   Right: Lesson settings
   Gradebook tab: spreadsheet-like grade entry
   Analytics tab: completion rates, assessment performance charts
```

---

# ════════════════════════════════════════════════════

# PHASE 9 — FINANCE MODULE

# Week 9–10 | [AGENT A] + [AGENT B] + [AGENT C]

# ════════════════════════════════════════════════════

## Prompt 9.1 — Finance Backend

```
[AGENT A — Claude Opus 4] for financial logic + [AGENT B] for implementation

Build apps/api/src/modules/finance/. Real money — extreme care required.

PAYMENT GATEWAY ABSTRACTION (Strategy Pattern):
interface PaymentGateway {
  initializePayment(dto): Promise<{ paymentUrl, reference }>
  verifyPayment(reference): Promise<{ status, amount, metadata }>
  initiateRefund(reference, amount): Promise<{ refundRef }>
  handleWebhook(payload, signature): Promise<void>
}

Implementations:
  StripeGateway, FlutterwaveGateway, PaystackGateway, PaymobGateway
Institution selects gateway in entity.settings.paymentGateway
PaymentService resolves correct gateway at runtime

FeeManagementModule:
  Fee structure CRUD (Finance Director only)
  Auto-charge on enrollment: EventEmitter 'enrollment.created' → charge fee
    NOTE: Auto-charge only triggers if student.enrollmentStatus == ACTIVE
    INACTIVE students cannot be charged (StudentRecordPostingGuard concept for finance)
  Bulk charge: all students in a programme (BullMQ job)
  Fee waiver: requires Finance Director approval (WorkflowEngine)

AccountsModule (Double-Entry Ledger):
  NEVER update Student.balance directly — always via Transaction
  getBalance(studentId): computed from SUM of completed transactions
    Cache in Redis (TTL 1hr), invalidate on new transaction
  Financial holds: auto-place if balance > threshold + overdue > 30 days
  Payment plans: installment tracking + BullMQ reminder jobs

PaymentsModule:
  Student payments: gateway → webhook → verify → create Transaction (PAYMENT type)
  Receipts: puppeteer PDF → S3 → email to student
  Refunds: require Finance Director approval (WorkflowEngine)
  Webhook handlers for each gateway: ALWAYS verify signatures first

ScholarshipsModule:
  Application portal (uses custom form engine)
  Award workflow (WorkflowEngine: SCHOLARSHIP_AWARD)
  Disbursement: create Transaction (SCHOLARSHIP_CREDIT type)

ReportsModule:
  Revenue by period, programme, fee type
  Outstanding balances aging (0–30, 31–60, 61–90, 90+ days)
  Payment method breakdown
  Export: Excel (exceljs) + PDF (puppeteer)
  Finance Director: institution-wide | Dean: faculty | HoD: department

CRITICAL RULES:
  ALL financial mutations wrapped in Prisma $transaction
  Every transaction: AuditLog entry
  Student notified on every transaction (email + in-app)
  Receiving payment from INACTIVE student: ALLOWED (clears pre-existing debt)
  Creating NEW charges for INACTIVE student: NOT ALLOWED
```

---

# ════════════════════════════════════════════════════

# PHASE 10 — HR & STAFF MODULE

# Week 10–11 | [AGENT B] + [AGENT C]

# ════════════════════════════════════════════════════

## Prompt 10.1 — HR Backend & Frontend

```
[AGENT B — Claude Sonnet 4]

Build apps/api/src/modules/staff/ and apps/api/src/modules/leave/.

StaffManagementModule:
  StaffProfile CRUD (dual-scoped — staff belongs to one entity)
  Cross-entity staff: UserEntityAccess grants teaching rights in multiple entities
  Workload tracking: credit hours per semester (WorkloadRecord)
  Workload limit enforcement: alert/block if exceeding maxCreditHours per entity settings
  AI feature: optimal workload distribution suggestion

LeaveModule:
  Leave type configuration per institution
  Leave balance management (allocated, used, carried over)
  Request workflow (WorkflowEngine: LEAVE_REQUEST)
  Calendar integration: block dates after approval
  Entitlement enforcement: reject if insufficient balance

AppraisalModule:
  Configurable KPI sets per position level
  Annual appraisal cycle management
  360 review option: collect peer feedback
  Self-assessment + reviewer rating
  Workflow: staff submits → HoD reviews → Dean endorses

OrgChartModule:
  Staff directory with org chart derived from OrgUnit tree + PositionHolder
  GET /staff/org-chart?entityId=X → nested structure with staff photos + positions

Frontend (/staff/page.tsx):
  Staff registry table with position, entity, contact
  Workload heatmap (which lecturers are near capacity)
  Leave calendar (FullCalendar)
  Appraisal status tracker
```

---

# ════════════════════════════════════════════════════

# PHASE 11 — ELECTIONS & MEETINGS

# Week 11–12 | [AGENT A] + [AGENT B] + [AGENT C]

# ════════════════════════════════════════════════════

## Prompt 11.1 — Elections Backend

```
[AGENT A — Claude Opus 4]

Build elections module with cryptographically sound anonymous voting.

VOTING SECURITY:
  voterHash = SHA-256(electionId + userId + institutionSecret)
  Stored in ElectionVote — NOT the userId directly
  Voter can verify their vote was counted (verificationToken matches)
  No one can trace a vote back to a specific voter
  @@unique([electionId, voterHash, position]) prevents double-voting at DB level

Features:
  Voter eligibility verification (check enrollment status, level, programme)
  Nomination management with manifesto upload
  Voting period enforcement (cannot vote outside voting dates)
  Real-time vote count visible to admins only during voting
  Results certification workflow: Electoral Committee → Registrar → publish
  Complete audit log of election management (not individual votes)
  Institution-wide elections (across all entities) + entity-scoped elections
```

## Prompt 11.2 — Meetings + AI Minutes

```
[AGENT B — Claude Sonnet 4]

Build meetings module with AI-powered minutes generation.

Meeting types respect hierarchy:
  Senate, Academic Board: institution-wide (convened by VC/Registrar)
  Faculty Board: entity-scoped (convened by Dean)
  Departmental: entity-scoped (convened by HoD)
  Committee: scoped to committee OrgUnit

Features:
  Meeting CRUD with agenda builder (drag-and-drop agenda items)
  Attendee management: invitations → RSVPs → in-meeting attendance marking
  In-meeting tools: live vote on resolutions, action item creation
  iCal export + Zoom/Teams link auto-creation (via integration)

AI Minutes Generator:
  POST /meetings/:id/generate-minutes { transcript: string }
  Send to AI with prompt:
    "Extract from this meeting transcript:
     1. Attendees present and their roles
     2. Agenda items discussed (match to agenda if provided)
     3. Decisions made on each item
     4. Resolutions passed (with vote counts if mentioned)
     5. Action items with assigned persons and due dates
     Format as JSON matching MinutesSchema."
  AI returns structured JSON → convert to formatted Word/PDF
  Human review: Convener reviews draft → approves → Registrar files
  Action items: tracked with completion status + reminder notifications

Resolution register: searchable history of all passed resolutions
Committee management: standing + ad-hoc committees with terms
```

---

# ════════════════════════════════════════════════════

# PHASE 12 — ALUMNI & SPORTS

# Week 12–13 | [AGENT B] + [AGENT C]

# ════════════════════════════════════════════════════

## Prompt 12.1 — Alumni Module

```
[AGENT B — Claude Sonnet 4]

Build apps/api/src/modules/alumni/.

Alumni self-registration:
  Cross-check against Student records (graduationConfirmedAt must be set)
  Link AlumniProfile → Student record (same userId)
  entityId: entity they graduated from

Features:
  Alumni directory with search (name, industry, location, programme, graduation year)
  Chapter management: regional coordinators manage their chapter members
  Event management: create, register, payment for paid events
  Job board: alumni post opportunities, students browse + apply
  Fundraising campaigns with donation processing via payment gateway

AI-Powered Mentorship Matching:
  Embed alumni expertiseAreas + career history in pgvector
  Embed student careerGoals + programme
  Cosine similarity → ranked list of compatible mentors
  POST /alumni/mentorship/suggest-matches?studentId=X
  Faculty of student's department can see suggestions

Bulk communication:
  Newsletter to alumni segments (by chapter, graduation year, programme)
  Email template engine with institution branding

Annual alumni survey with analytics
```

## Prompt 12.2 — Sports Module

```
[AGENT B — Claude Sonnet 4]

Build apps/api/src/modules/sports/.

Academic Eligibility Enforcement:
  Player.isEligible computed from Student.currentGPA vs institution minimum
  BullMQ job: after every grade release, recalculate eligibility for all players
  AI Alert: "3 players on the Basketball team are at GPA risk this semester"
  Ineligible player: blocked from Fixture.statistics + competition registration

Features:
  Team + roster management with medical clearance tracking
  Facility booking calendar (FullCalendar) with conflict detection
  Competition + fixture management with live score entry
  Player statistics tracking with career history
  Inter-entity competitions: fixtures between teams from different entities
  Away fixture transport + accommodation logistics tracking
  Sports awards and institutional records management
```

---

# ════════════════════════════════════════════════════

# PHASE 13 — AI INTELLIGENCE LAYER

# Week 14 | [AGENT A] + [AGENT B]

# ════════════════════════════════════════════════════

## Prompt 13.1 — AI Infrastructure + Features

```
[AGENT A — Claude Opus 4] for design + [AGENT B] for implementation

Build apps/api/src/modules/ai/.

AI PROVIDER ABSTRACTION:
interface AIProvider {
  complete(messages: ChatMessage[], options?): Promise<string>
  stream(messages: ChatMessage[], options?): AsyncIterable<string>
  embed(text: string): Promise<number[]>
}
Implement: OpenAIProvider, AnthropicProvider
AIService: selects provider based on Institution.settings.aiProvider
Institution can bring own API key (stored encrypted)
Token usage tracked: daily limit configurable per plan

RAG PIPELINE (EmbeddingsService):
  embed(text): calls AI embed endpoint → number[]
  upsertDocument(institutionId, entityId, sourceType, sourceId, content, metadata):
    embed → store in EmbeddingDocument (pgvector)
  similaritySearch(institutionId, entityId, query, topK, sourceTypes[]):
    embed query → SELECT with <-> operator (cosine distance) → return chunks
  BullMQ job: EmbedContentJob fires on lesson publish/update

AI FEATURES:

1. AI Tutor (Student-facing, course-context RAG):
   POST /ai/tutor/:courseInstanceId/message → SSE streaming
   RAG: search only enrolled course materials + within student's accessible entities
   Socratic: guide to answer, don't give directly
   Cite which lesson/document the answer came from
   Daily token limit per student (configurable per plan)

2. AI Academic Advisor:
   POST /ai/advisor/:studentId
   Input: academic history, programme requirements, career goals (all entities)
   Output: graduation gap analysis, course recommendations, at-risk flags
   Shown in student profile AI Insights panel

3. Faculty Content Tools:
   POST /ai/content/summarize-lesson { lessonId }
   POST /ai/content/generate-quiz { lessonId, count, difficulty }
   POST /ai/content/generate-rubric { assignmentDescription }
   POST /ai/essay/feedback { submissionId }

4. AI Meeting Minutes:
   POST /ai/meetings/generate-minutes { meetingId, transcript }
   Structured JSON extraction → formatted draft minutes

5. AI Administrative Intelligence:
   POST /ai/analytics/narrative/:institutionId
     Generates cross-entity weekly narrative report (for VC)
   POST /ai/analytics/narrative/:institutionId/:entityId
     Single-entity narrative (for entity Principal)
   Billing anomaly detection:
     Compare DailyBillableSnapshot to 7-day + 30-day averages
     Sudden drop > 10%: flag as potential gaming attempt → alert UniCore team
   Student dropout risk prediction (per entity + consolidated)

6. AI Timetabling Assistant:
   Input: sections to schedule, rooms, faculty availability, constraints
   Output: multiple conflict-free schedule options ranked by optimisation score

7. AI Mentorship Matching (Alumni module — see Phase 12)

PII PROTECTION:
  Strip names, studentNumbers, emails before sending to external AI APIs
  Use anonymised references: "Student A", "Student B"
  Never send institutionId to external AI
  All AI-generated content: flagged with isAIGenerated: true
  Human-in-the-loop enforced for: grade changes, status changes, suspension

6. INTELLIGENT TIMETABLING ENGINE:
   Constraint satisfaction: no clashes, respect room capacity,
   faculty workload balance, student preference weighting
   Multiple options generated → human selects
```

---

# ════════════════════════════════════════════════════

# PHASE 14 — NOTIFICATIONS & CUSTOMIZATION

# Week 14–15 | [AGENT B] + [AGENT C]

# ════════════════════════════════════════════════════

## Prompt 14.1 — Notification Engine

```
[AGENT B — Claude Sonnet 4]

Build apps/api/src/modules/notifications/.

Multi-channel notification engine with entity-level template overrides.

Template resolution (three-level cascade):
  1. Entity-specific template (entity has customised this notification)
  2. Institution-level template
  3. UniCore platform default

NotificationService.send({
  institutionId, entityId, recipientId,
  event,      (e.g. 'GRADE_RELEASED', 'STATUS_CHANGED', 'FEE_DUE')
  data,       (template variables)
  channels?,  (override default channels for this send)
  priority?   (HIGH | NORMAL | LOW)
})
  Resolve template via cascade
  For each channel: dispatch to BullMQ queue
  Store Notification record (for in-app notification center)

Channels:
  email:  nodemailer + Handlebars HTML (institution SMTP or platform SMTP)
  sms:    Twilio or Africa's Talking (institution configures provider)
  push:   Firebase Cloud Messaging (for future mobile app)
  inApp:  WebSocket push + Notification record

Smart features:
  Digest mode: group low-priority notifications into hourly digest
  Quiet hours: respect user timezone + preferences.quietHours
  Channel fallback: push fails → email
  Read receipts: mark Notification.readAt when viewed

Bulk notifications:
  Target: ALL_INSTITUTION | SPECIFIC_ENTITY | ALL_EXCEPT_ENTITY | BY_PROGRAMME
  Used for: "All Extramural students: registration opens Monday"
  Institution admin: can broadcast to ALL entities
  Entity admin: can broadcast within their entity only

Scheduled notifications: queue for future delivery via BullMQ delayed jobs

KEY EVENTS that trigger notifications:
  Status changes: GAIN/LOSS billing impact notifications to Registrar + Finance
  Grade released: notify student
  Fee due: 7 days, 3 days, 1 day before → notify student + guardian
  Workflow action assigned: notify assignee
  Workflow SLA warning: notify assignee + supervisor
  Document ready: notify student
  Election voting open: notify eligible voters
  Backfill approved: notify institution + billing consequence reminder
```

## Prompt 14.2 — Institution & Entity Customization Engine

```
[AGENT B — Claude Sonnet 4]

Build apps/api/src/modules/customization/.

TWO-LEVEL SETTINGS:
  Institution settings (VC/Registrar sets)
  Entity settings (entity admin sets — within institution constraints)

getEffectiveSetting(key, institutionId, entityId):
  Check entity-specific setting → if found return it
  Check institution setting → if found return it
  Return UniCore platform default

Entity-customisable settings:
  Branding: logo, primaryColor, customDomain
  studentNumberFormat: "EXT/YYYY/[SEQ:4]"
  Fee structures (entity has different fees)
  Payment gateway (entity may use different provider)
  Grading system (percentage vs GPA)
  Semester structure (different term names)
  Enabled modules (subset of institution's modules)
  Notification templates (entity-branded emails)
  Academic calendar (slightly different dates)

NOT overridable by entity:
  Authentication method (SSO, MFA)
  Data retention policies
  Audit log settings
  Subscription/billing

Custom Forms Engine:
  ApplicationForm, Scholarship applications, Surveys, Feedback
  Field types: text, textarea, number, date, select, multiselect,
               file, checkbox, radio, section_header, conditional_logic
  Schema stored as JSON in ApplicationForm.schema
  POST /forms/:id/submit → store FormSubmission with validation
  Submission analytics: response rates, field completion, trends

FRONTEND — /settings pages:
  /settings/branding → logo upload, colour picker, domain config
  /settings/academic → grading scale, semester names, calendar
  /settings/custom-forms → drag-and-drop form builder
  /settings/notifications → template editor per notification event
  /settings/integrations → Zoom, WhatsApp, Calendar config
  /settings/payment → gateway selection + API key (masked input)
```

---

# ════════════════════════════════════════════════════

# PHASE 15 — STUDENT & GUARDIAN PORTALS

# Week 15 | [AGENT C]

# ════════════════════════════════════════════════════

## Prompt 15.1 — Student Portal

```
[AGENT C — GPT-4o]

Build the complete student-facing portal. Personal scope only.
Student CANNOT see data of other students.
INACTIVE student: all write actions blocked, read-only access only.

Design: Modern, approachable. Navy sidebar, white content, teal accent (#0d9488).
Font: Plus Jakarta Sans. Feels like Notion meets a premium university portal.

Key pages:

/dashboard — Student Home
  Greeting + time-based message
  CGPA ring, credit progress bar
  "Continue Learning" card (last accessed LMS course)
  Today's schedule from timetable
  Due-soon: assessments + exams in next 7 days (sorted by urgency)
  Announcements feed
  AI academic tip: "Based on your MATH301 attendance (61%), review
  Chapter 4 before Thursday's session."

/my-courses — LMS Course Dashboard
  Course cards: cover, progress ring, Lecturer, next due item
  "Continue" deep-links to last lesson

/my-grades — Academic Record
  Semester selector → course grades table
  CGPA trend chart + grade details modal

/my-finance — Student Finance
  Balance card (green=credit, red=outstanding)
  "Pay Now" → payment gateway
  Payment history + receipts

/my-documents — Document Center
  Issued documents list + download
  "Request Document" → wizard

/my-attendance — Attendance
  Per-subject bars + calendar heatmap
  Warning: subjects below 75% highlighted

/register-courses — Course Registration (see Phase 7)
```

## Prompt 15.2 — Guardian Portal

```
[AGENT C — GPT-4o]

Build guardian/parent portal. Limited scope: only linked students.
Institution configures what guardians can see (in entity settings).

/guardian/dashboard — Overview of all linked students
  Student cards: name, programme, CGPA, balance, ACTIVE status
  Alert badges: outstanding balance, low attendance, upcoming exams

/guardian/[studentId]/academic — Grades + CGPA (if allowed)
/guardian/[studentId]/finance  — Balance + "Pay on Behalf" button (if allowed)
/guardian/[studentId]/attendance — Per-subject (if allowed)

Design: Calm, formal, large text. Mobile-first.
Guardians are often non-technical and access via phone.
High-contrast, clear CTAs, minimal navigation.
```

---

# ════════════════════════════════════════════════════

# PHASE 16 — SECURITY AUDIT & PERFORMANCE

# Week 16 | [AGENT A] + [AGENT D]

# ════════════════════════════════════════════════════

## Prompt 16.1 — Security Audit

```
[AGENT A — Claude Opus 4] + [AGENT D — Gemini 1.5 Pro]

Comprehensive security audit. Generate a findings report + fixed code.

BILLING INTEGRITY AUDIT:
  Run: grep -rn "enrollmentStatus" apps/api/src/modules/ | grep -v "StatusChangeService" | grep "update"
  Expected result: ZERO matches. Any match = P0 bug.
  Verify: StatusChangeService.changeStatus() is the ONLY writer of enrollmentStatus

  Run: grep -rn "@UseGuards" apps/api/src/modules/ | grep -v "StudentRecordPostingGuard" | grep -E "@(Post|Put|Patch)"
  Cross-reference with student-write endpoints — every one must have the guard.

  Verify: DailyBillableSnapshot has no institution-accessible mutation endpoint.
  Verify: StatusChangeLog has no UPDATE or DELETE anywhere.
  Verify: BackfillRequest.billingAcknowledged enforced before workflow starts.

ENTITY ISOLATION AUDIT:
  Test: Create 2 institutions. Create 2 entities per institution.
  Log in as Entity 1A user. Attempt access to Entity 1B data → must 403/404.
  Log in as Institution 1 VC. Attempt access to Institution 2 data → must 403/404.
  Log in as Affiliate (EXTERNAL) → verify ONLY verify-student + verify-transcript work.
  Verify: Cannot switch to entity in different institution.
  Verify: Cannot switch to EXTERNAL affiliate entity.

FINANCIAL SECURITY:
  Webhook signature verification: test with invalid signature → must reject.
  Transaction records: no UPDATE query on Transaction table (immutable).
  Refund: requires Finance Director approval workflow.

APPLICATION SECURITY:
  Helmet.js headers on all responses: verify CSP, HSTS, X-Frame-Options.
  Rate limiting: test 6 login attempts in 15 min → must block.
  File uploads: upload file with wrong extension but correct magic bytes → accept.
                upload file with image extension but PDF magic bytes → reject.
  Presigned URLs: generate URL, wait >1hr, attempt access → must fail.

ENCRYPTION:
  Verify sensitive fields (salary, paymentGatewayConfig, mfaSecret)
  are AES-256-GCM encrypted at rest — not plaintext in DB.

Generate: security-findings-report.md with severity ratings.
Generate: fixes for any CRITICAL or HIGH findings.
```

## Prompt 16.2 — Performance Optimisation

```
[AGENT D — Gemini 1.5 Pro]

Review for performance issues and implement fixes.

DATABASE:
  Run EXPLAIN ANALYZE on 20 most common queries.
  Verify indexes exist on every frequently-queried column.
  Key indexes to check:
    DailyBillableSnapshot: (institutionId, snapshotDate) → used daily in billing
    Student: (institutionId, entityId, enrollmentStatus, deletedAt) → billing query
    StatusChangeLog: (institutionId, entityId, studentId) → status history
    StudentEnrollment: (institutionId, entityId, semesterId, status)
    EmbeddingDocument: ivfflat index on embedding column (lists=100 for pgvector)
  N+1 query elimination: audit all Prisma findMany calls for missing includes.
  Connection pooling: configure PgBouncer for production.

CACHING STRATEGY (Redis):
  Institution settings:      TTL 5min   (invalidate on settings update)
  Entity settings:           TTL 5min   (invalidate on entity settings update)
  User permissions (JWT):    TTL 15min  (invalidate on position change)
  Course structure:          TTL 30min  (invalidate on course publish)
  Fee structures:            TTL 1hr    (invalidate on fee update)
  Student GPA (computed):    TTL 1hr    (invalidate on grade publish)
  OrgUnit tree:              TTL 1hr    (invalidate on org change)
  Today's billable count:    TTL 24hr   (for entity switcher display)

FRONTEND PERFORMANCE:
  Server Components: all data-display pages (no useEffect for initial data)
  Client Components: only for forms, interactive tables, real-time data
  Dynamic imports: PDF viewer, HLS.js player, TipTap editor, chart library
  TanStack Virtual: all lists with >100 rows
  Image optimisation: next/image, WebP, proper sizes attribute
  Bundle analysis: run next bundle-analyzer, eliminate large unused deps

API PERFORMANCE:
  Response compression (gzip via compression middleware)
  Streaming for large CSV/Excel exports (don't buffer full file in memory)
  Field selection: ?fields=id,name (avoid over-fetching on mobile)
  DataLoader pattern for batch-loading related records

TARGET BENCHMARKS:
  API p99 latency < 300ms
  Page LCP < 2.5s
  Lighthouse score > 90
  Billing snapshot job < 500ms per institution-entity pair
```

---

# ════════════════════════════════════════════════════

# PHASE 17 — DEVOPS, DEPLOYMENT & MONITORING

# Week 17 | [AGENT B]

# ════════════════════════════════════════════════════

## Prompt 17.1 — Production Infrastructure

```
[AGENT B — Claude Sonnet 4]

Generate all production deployment configuration.

DOCKERFILES (multi-stage, minimal Alpine images):
  apps/api/Dockerfile:
    Stage 1 (deps): pnpm install
    Stage 2 (build): tsc build + prisma generate
    Stage 3 (prod): node:20-alpine, copy built files only, no dev deps
    Run as non-root user (uid 1001)
    HEALTHCHECK: GET http://localhost:3000/health
    Expose 3000

  apps/web/Dockerfile: Next.js standalone output
  apps/admin/Dockerfile: same pattern

KUBERNETES (k8s/ directory):
  Deployment: api, web, admin — each with rolling update strategy
  HPA: api scales when CPU > 70% or memory > 80%
  Service + Ingress: nginx-ingress + cert-manager (Let's Encrypt)
    Wildcard: *.unicore.io → resolve institution + entity from subdomain
    Entity subdomain: ext.unilag.unicore.io → X-Entity-Code: EXT header
  Secrets: External Secrets Operator (AWS Secrets Manager)
  PodDisruptionBudget: maintain at least 1 pod during rolling updates
  NetworkPolicy: api accessible only from web + admin pods
  Pre-install hook: database migration job (runs before deployment)

NGINX ENTITY ROUTING:
  unilag.unicore.io → institution slug: "unilag", no entity
  ext.unilag.unicore.io → slug: "unilag", entity code: "EXT"
  dl.unilag.unicore.io → slug: "unilag", entity code: "DL"
  sis.unilag.edu.ng → custom domain lookup, no entity code
  nginx extracts codes from subdomain parts → passes as headers

GITHUB ACTIONS (complete CI/CD):
  PR: lint + typecheck + unit tests + integration tests (Testcontainers)
  merge to main: above + build Docker images + push to ECR + deploy to staging
  release tag: deploy to production with health check gate + rollback capability

OBSERVABILITY:
  Structured logging (Winston):
    Format: { timestamp, level, correlationId, institutionId?, entityId?,
              userId?, message, ...meta }
    Every request: correlationId generated in middleware, propagated everywhere

  Prometheus metrics:
    api_request_duration_seconds { method, route, status }
    billing_snapshot_count { institution_id, entity_id }        ← daily active students
    billing_snapshot_duration_ms { institution_id }             ← job performance
    billing_anomaly_total { institution_id }                    ← suspicious drops
    student_status_change_total { from_status, to_status }      ← status transitions
    workflow_step_duration_seconds { workflow_code, step }       ← approval speed
    ai_token_usage_total { institution_id, feature }            ← AI cost tracking
    queue_job_duration_seconds { queue_name, job_type }

  Grafana dashboards:
    Per-institution active student count over time (billing visibility)
    API latency p50/p99 per route
    Workflow completion rates and SLA breach rates
    Billing anomaly alerts (>10% drop in 7 days)

  Alerts:
    DailySnapshotJob fails → PagerDuty (critical — affects billing)
    MonthlyBillingJob fails → PagerDuty (immediate — blocks revenue)
    Billing anomaly detected → billing team Slack alert
    API error rate > 1% → on-call alert
    Any entity has 0 sessions for > 48hr → entity health alert

  Error tracking: Sentry for both API and frontend
  APM: OpenTelemetry distributed traces (API → DB → Redis → Queue)

HEALTH ENDPOINTS:
  GET /health → { status: 'ok', version, uptime }
  GET /health/ready → checks DB, Redis, queue connectivity

BACKUP & DR:
  PostgreSQL: daily pg_dump to S3, 30-day retention
  Point-in-time recovery: WAL archiving to S3
  Redis: AOF persistence + daily RDB snapshot to S3
  BillingEvidence files: S3 versioning, 7-year retention
  Invoice PDFs: S3 versioning, 7-year retention
  StatusChangeLog, AuditLog: included in daily backup
  RTO target: < 4 hours | RPO target: < 1 hour
  DR runbook: backup verification + restoration steps documented

BILLING JOB RELIABILITY:
  All billing BullMQ jobs:
    attempts: 3, backoff: { type: 'exponential', delay: 5000 }
    removeOnComplete: false  (keep for financial audit trail)
    removeOnFail: false      (keep for investigation)
  DailySnapshotJob: jobId = 'daily-snap-{inst}-{entity}-{YYYY-MM-DD}' (dedup)
  MonthlyBillingJob: jobId = 'monthly-{inst}-{YYYY-MM}' (dedup prevents double invoice)
  RetroactiveBillingJob: must complete before BackfillWindow activated
```

---

# ════════════════════════════════════════════════════

# PHASE 18 — INTEGRATIONS, MARKETPLACE & PUBLIC API

# Week 18 | [AGENT B]

# ════════════════════════════════════════════════════

## Prompt 18.1 — Integration Framework + Public API

```
[AGENT B — Claude Sonnet 4]

Build apps/api/src/modules/integrations/.

INTEGRATION INTERFACE (Strategy Pattern):
interface UniCoreIntegration {
  code: string
  name: string
  category: IntegrationCategory
  configure(institutionId, entityId, settings: Json): Promise<void>
  test(institutionId, entityId): Promise<{ success, message }>
  disable(institutionId, entityId): Promise<void>
}

INTEGRATIONS TO IMPLEMENT:

Video Conferencing:
  ZoomIntegration: auto-create Zoom meeting for Section.schedule + meetings
  BigBlueButtonIntegration: open-source, self-hosted option
  MicrosoftTeamsIntegration: for Microsoft-stack institutions

Communication:
  WhatsAppBusinessIntegration: bulk notifications via WhatsApp API
  TwilioSmsIntegration: OTP, payment alerts, attendance warnings
  SlackIntegration: staff notification channels

Academic:
  TurnitinIntegration: submit assignment → get plagiarism report
  GoogleScholarIntegration: fetch staff publication citations

Calendar:
  GoogleCalendarIntegration: two-way sync for meetings + classes
  MicrosoftOutlookIntegration: same for Microsoft shops
  iCalExport: subscribe URL (no auth — read-only)

Payment (already in Finance module — expose config here):
  Stripe, Flutterwave, Paystack, Paymob, MTN MoMo, M-Pesa

Entity-level configuration:
  Each entity can enable/configure integrations independently
  Settings resolution: entity → institution → platform default

WEBHOOK SYSTEM:
  Institution subscribes to platform events per entity:
    { entityId?, event: 'student.enrolled', url, secret }
  Events: student.enrolled, grade.released, payment.received,
          student.status_changed, workflow.completed, etc.
  Delivery: BullMQ job with exponential backoff retry (max 5 attempts)
  Webhook logs: every attempt with response code + body
  Webhook testing: POST /integrations/webhooks/:id/test → send sample payload

PUBLIC REST API:
  API key management: create, name, scope, rate limit, revoke
  Authentication: Authorization: Bearer {apiKey}
  Entity routing: ?entityId= query param OR X-Entity-ID header
  All institution-scope endpoints accessible via API key
  OpenAPI spec: auto-generated, served at /api-docs
  Postman collection: generated from OpenAPI spec

GraphQL API (optional — institution plan feature):
  Apollo Server
  All standard queries + mutations available
  Subscription for real-time events

MOBILE APP API READINESS:
  All endpoints support: cursor pagination, field selection (?fields=)
  FCM token registration: POST /users/fcm-token
  Offline sync endpoints:
    GET /sync/attendance?since={timestamp}&entityId=X → changed records
    POST /sync/attendance/bulk → upload offline QR-scanned attendance
```

---

# ════════════════════════════════════════════════════

# PHASE 19 — ACADEMIC PROGRESSION (PROMOTION & REPEAT)

# Week 10+ | [AGENT B] + [AGENT C] — requires Phase 7 (SIS), Phase 4 (Workflow)

# ════════════════════════════════════════════════════

## Prompt 19.1 — Academic Progression (Promotion & Repeat)

```
[AGENT B — Claude Sonnet 4] + [AGENT C — GPT-4o for registrar UI]

Normative rules: `.cursorrules` SECTION 15 — Academic Progression: Promotion & Repeat.
Academic progression is SEPARATE from billing: promoted and repeating students stay ACTIVE
and billable unless another status path applies (e.g. rustication = INACTIVE, not a repeat).

────────────────────────────────────────────────────────────────
A. DOMAIN MODEL (Prisma, dual-scoped where applicable)
────────────────────────────────────────────────────────────────
ProgressionRule (institutionId, programmeId optional row-level rules):
  minGpaPromotion, conditionalPromotionMinGpa, maxCarryoverCourses,
  maxRepeatAttemptsPerLevel, maxProgrammeDurationYears, maxResitAttempts,
  resitGradeCapPercent, gpaRepeatPolicy enum:
    BEST_OF_ATTEMPTS | LAST_ATTEMPT | ALL_ATTEMPTS_AVERAGE | FIRST_ATTEMPT_ONLY
  Defaults per .cursorrules 15.6 (document in seed comments).

StudentAcademicSession (per student × programme × level/year × academic period):
  attemptNumber Int @default(1)
  repeatReason enum nullable:
    FULL_REPEAT | CARRYOVER | RESIT_CONTEXT | RUSTICATION_RETURN | ...
  Links to semester/year identifiers already in schema

ProgressionDecision — IMMUTABLE (LAW P1):
  id, studentId, institutionId, entityId, programmeId,
  decisionType: PROMOTION | REPEAT | DEFERRED | MANUAL_PROMOTION | ...
  promotionSubtype: AUTOMATIC | CONDITIONAL | DEFERRED | MANUAL | null
  repeatSubtype: FULL_REPEAT | SUPPLEMENTARY_CARRYOVER | RESIT |
                 DEFERRED_EXAMINATION | AEGROTAT | null
  academicPeriodRef (semester/year id), priorDecisionId nullable (chain),
  supersededByDecisionId nullable (appeals — NEW row supersedes, never UPDATE),
  payload Json (thresholds snapshot, GPA snapshot, justification refs),
  createdAt, createdByUserId
  NO UPDATE / DELETE — repository rejects mutating queries

ProgressionHold (when DEFERRED promotion):
  type FINANCIAL | ACADEMIC | ADMINISTRATIVE | LIBRARY | ...,
  clearedAt nullable, ties to student + period

CarryoverEnrollment (LAW P4):
  originalEnrollmentId (failed attempt), repeatEnrollmentId (new attempt),
  label for transcript: "Carryover from <period>"

ResitRecord (LAW P3):
  enrollmentId or assessment component ref, attemptNumber,
  gradeCapApplied boolean, cappedAtPercent, faculty cannot bypass cap at write time

Rustication vs repeat (.cursorrules 15.2):
  Rustication handled ONLY via StatusChangeService → INACTIVE; transcript gap, no grades
  Repeat = ACTIVE pathway; StudentRecordPostingGuard allows posts

────────────────────────────────────────────────────────────────
B. SERVICES & ENFORCEMENT
────────────────────────────────────────────────────────────────
ProgressionEvaluationService:
  Trigger: after grade publication event (or batch job per semester close)
  Load ProgressionRule for student’s programme
  Compute eligibility: AUTOMATIC / CONDITIONAL paths per .cursorrules 15.3
  DEFERRED: emit ProgressionHold + ProgressionDecision DEFERRED
  MANUAL / AEGROTAT: create pending workflow only — no auto decision row until approved

RepeatEnrollmentGuard (used by EnrollmentModule):
  Block new StudentEnrollment if attemptNumber > maxRepeatAttemptsPerLevel
  Block if totalYearsEnrolled > maxProgrammeDurationYears → force academic review workflow
  Attach originalSemesterId + attemptNumber on every repeat enrollment (LAW P2)

GpaComputationService extension (.cursorrules 15.5):
  Apply institution gpaRepeatPolicy; resit grades capped BEFORE contribution (LAW P3)
  Transcript shows all attempts; footer note for policy

ResitGradeService:
  Single path for entering resit outcomes; clamps to cap; audit if cap path taken

────────────────────────────────────────────────────────────────
C. WORKFLOWS (.cursorrules 15.8)
────────────────────────────────────────────────────────────────
Wire WorkflowEngine definitions:
  CONDITIONAL_PROMOTION, FULL_REPEAT_APPROVAL, MANUAL_PROMOTION, AEGROTAT,
  MAX_DURATION_REVIEW
Steps: HoD → Dean → Board/Senate → Registrar confirm
Registrar confirmation materialises an append-only ProgressionDecision

────────────────────────────────────────────────────────────────
D. API (NestJS)
────────────────────────────────────────────────────────────────
GET  /sis/progression/rules — list/configure (permission: REGISTRAR or ACADEMIC_ADMIN)
POST /sis/progression/evaluate-batch — semesterId, dryRun flag
GET  /students/:id/progression-decisions — history newest-first
POST /students/:id/progression-holds — place hold (DEFERRED path)
PATCH /students/:id/progression-holds/:holdId/clear
POST /enrollments (repeat context) — validate LAW P2 fields

OpenAPI + AuditLog on every mutation; entity isolation.

────────────────────────────────────────────────────────────────
E. FRONTEND (apps/web)
────────────────────────────────────────────────────────────────
/students/[id] — new "Progression" sub-panel or Academic tab section:
  Latest decision banner, holds list, repeat attempt counters, plain-language next steps
/registrar/progression (or under /workflow) — batch evaluation UI, dry-run diff,
  drill-down into students flagged for FULL_REPEAT or duration exceed

────────────────────────────────────────────────────────────────
F. TESTS (block release)
────────────────────────────────────────────────────────────────
  [ ] Repeating student remains ACTIVE; POST /grades succeeds (same as normal ACTIVE)
  [ ] Rusticant INACTIVE: no grade post; repeat after return creates ACTIVE repeat path
  [ ] ProgressionDecision: no UPDATE/DELETE in codebase (grep + integration)
  [ ] Resit grade above cap rejected or clamped deterministically
  [ ] Carryover enrollment requires both FKs; transcript label data present
  [ ] maxRepeatAttemptsPerLevel blocks enrollment with clear error + audit
```

---

# ════════════════════════════════════════════════════

# CROSS-CUTTING REQUIREMENTS

# Apply to EVERY prompt in every phase

# ════════════════════════════════════════════════════

```
MANDATORY CHECKLIST — add to every Cursor chat:

□ DUAL SCOPE
  institutionId + entityId on all scoped models.
  Middleware injects both. Services NEVER add manually.
  EntityScopeGuard on all entity-scoped controller endpoints.

□ STUDENT RECORD GUARD
  @UseGuards(StudentRecordPostingGuard) on all student-write endpoints.
  Backfilled records: isBackfilled: true + backfillRequestId set from guard context.

□ STATUS ENFORCEMENT
  Student.enrollmentStatus ONLY written by StatusChangeService.changeStatus().
  Instant logout: synchronous within transaction (not background).
  Read-only mode: guard blocks writes + UI disables all inputs + shows banner.

□ BILLING INTEGRITY
  DailyBillableSnapshot: written only by BillingSnapshotService.
  StatusChangeLog: IMMUTABLE — no UPDATE or DELETE anywhere.
  BackfillRequest: billingAcknowledged enforced.
  Retroactive invoice: generated on backfill approval (not deferred).

□ POSITION AUTHORITY
  @RequirePosition @RequirePermission @RequireScope on every write.
  Position level + scope + OrgUnit jurisdiction all checked.

□ WORKFLOW ENFORCEMENT
  Multi-step approvals ONLY through WorkflowEngine.
  No service implements its own approval logic.

□ AUDIT LOG
  AuditLogService.log with entityId + billingImplication on every mutation.
  Cross-entity actions: isCrossEntity: true.

□ SOFT DELETE
  No prisma.*.delete() in service code.
  Standard deletion: set deletedAt. Permanent deletion: anonymise + hard-delete auth user.

□ VALIDATION
  Backend: class-validator DTO on every controller method.
  Frontend: zod schema matching backend DTO exactly.
  OpenAPI: @ApiTags @ApiOperation @ApiResponse on every endpoint.

□ PAGINATION
  All list endpoints: { cursor?, limit, direction? } → { data, nextCursor, total }

□ ENTITY UI
  Entity badge on all records in institution-wide views.
  Billable count in entity switcher dropdown.
  Status timeline on student profile.
  INACTIVE banner + read-only mode for INACTIVE students.

□ NOTIFICATIONS
  Every user-facing action triggers appropriate notification.
  Entity-specific templates used where configured.

□ TESTS
  Unit tests (service layer), integration tests (controller layer).
  Entity isolation test (ENTITY A cannot see ENTITY B data).
  Billing integrity tests (ACTIVE counted, INACTIVE not counted, guard blocks writes).
  80% coverage minimum.
```

---

## 🏆 COMPETITIVE DIFFERENTIATORS — FEATURES NO COMPETITOR DOES WELL

```
BILLING (unique in market):
  ✓ Status-only billing rule — simple, airtight, self-enforcing
  ✓ Instant synchronous logout on inactivation — zero lag
  ✓ API-level records guard — cannot post records for inactive students
  ✓ Backfill = retroactive billing — no free records for paid-off students
  ✓ UniCore computes count independently — no self-reporting
  ✓ Immutable status log — complete billing audit trail

ARCHITECTURE (unique in market):
  ✓ Three-tier model: Institution → Entity → OrgUnit (no competitor)
  ✓ Entity provisioning in 60 seconds — add extramural school instantly
  ✓ Dual-scope middleware — one change enforces all tenant + entity boundaries
  ✓ Student transfers with continuous history + no billing gap
  ✓ Inter-entity course sharing — students access sibling entities' courses
  ✓ Affiliate API — secure student verification for external partners

GOVERNANCE (unique in market):
  ✓ Real university hierarchy — position levels, scopes, delegation
  ✓ Data-driven workflow engine — approval chains configurable without code
  ✓ Position scope enforcement — Dean sees Faculty, HoD sees Department

ACADEMICS (best in class):
  ✓ AI Tutor with RAG — course-aware, cites materials, Socratic method
  ✓ AI academic advisor — cross-entity transcript awareness
  ✓ Anonymous verified elections — cryptographically sound
  ✓ AI meeting minutes — upload transcript → structured minutes instantly
  ✓ Multi-entity transcripts — study across entities on one document
  ✓ Offline-first attendance — QR scanning works without internet

OPERATIONS (best in class):
  ✓ Zero-downtime migration from Banner, Canvas, Moodle
  ✓ Entity-level customization — fees, branding, workflows per sub-unit
  ✓ Separately billed entities — affiliate colleges get own invoice
  ✓ Intelligent timetabling — AI constraint satisfaction
  ✓ Guardian portal with configurable visibility
  ✓ Sports eligibility auto-enforcement via GPA check
```

---

_UniCore — Built for how universities actually work, not how software vendors
wish they worked. Every architectural decision traces back to a real university
problem, a real billing risk, or a real governance requirement._
