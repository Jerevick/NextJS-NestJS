-- CreateEnum
CREATE TYPE "InstitutionEntityType" AS ENUM (
  'MAIN_CAMPUS',
  'SCHOOL',
  'EXTRAMURAL',
  'DISTANCE_LEARNING',
  'SATELLITE_CAMPUS',
  'PROFESSIONAL_SCHOOL',
  'SUMMER_SCHOOL',
  'RESEARCH_INSTITUTE',
  'CONSTITUENT_COLLEGE',
  'AFFILIATE'
);

-- CreateEnum
CREATE TYPE "InstitutionEntityStatus" AS ENUM ('PROVISIONING', 'ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "InstitutionEntity" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "InstitutionEntityType" NOT NULL DEFAULT 'MAIN_CAMPUS',
  "status" "InstitutionEntityStatus" NOT NULL DEFAULT 'ACTIVE',
  "settings" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "InstitutionEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyBillableSnapshot" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "snapshotDate" TIMESTAMP(3) NOT NULL,
  "billableCount" INTEGER NOT NULL,
  "isLockedForBilling" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DailyBillableSnapshot_pkey" PRIMARY KEY ("id")
);

-- Default MAIN entity per institution (deterministic id for idempotent re-runs in dev)
INSERT INTO "InstitutionEntity" ("id", "institutionId", "code", "name", "type", "status", "settings", "createdAt", "updatedAt")
SELECT
  'ent_main_' || i."id",
  i."id",
  'MAIN',
  i."name" || ' — Main Campus',
  'MAIN_CAMPUS'::"InstitutionEntityType",
  'ACTIVE'::"InstitutionEntityStatus",
  '{}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Institution" i
WHERE i."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "InstitutionEntity" e WHERE e."institutionId" = i."id" AND e."code" = 'MAIN'
  );

-- AlterTable Student: add entityId
ALTER TABLE "Student" ADD COLUMN "entityId" TEXT;

UPDATE "Student" s
SET "entityId" = e."id"
FROM "InstitutionEntity" e
WHERE e."institutionId" = s."institutionId" AND e."code" = 'MAIN';

ALTER TABLE "Student" ALTER COLUMN "entityId" SET NOT NULL;

-- AlterTable BackfillRequest
ALTER TABLE "BackfillRequest" ADD COLUMN "entityId" TEXT;

UPDATE "BackfillRequest" br
SET "entityId" = s."entityId"
FROM "Student" s
WHERE s."id" = br."studentId";

ALTER TABLE "BackfillRequest" ALTER COLUMN "entityId" SET NOT NULL;

-- AlterTable BackfillWindow
ALTER TABLE "BackfillWindow" ADD COLUMN "entityId" TEXT;

UPDATE "BackfillWindow" bw
SET "entityId" = s."entityId"
FROM "Student" s
WHERE s."id" = bw."studentId";

ALTER TABLE "BackfillWindow" ALTER COLUMN "entityId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionEntity_institutionId_code_key" ON "InstitutionEntity" ("institutionId", "code");

CREATE INDEX "InstitutionEntity_institutionId_idx" ON "InstitutionEntity" ("institutionId");

CREATE UNIQUE INDEX "DailyBillableSnapshot_institutionId_entityId_snapshotDate_key" ON "DailyBillableSnapshot" ("institutionId", "entityId", "snapshotDate");

CREATE INDEX "DailyBillableSnapshot_institutionId_snapshotDate_idx" ON "DailyBillableSnapshot" ("institutionId", "snapshotDate");

-- AddForeignKey
ALTER TABLE "InstitutionEntity" ADD CONSTRAINT "InstitutionEntity_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyBillableSnapshot" ADD CONSTRAINT "DailyBillableSnapshot_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyBillableSnapshot" ADD CONSTRAINT "DailyBillableSnapshot_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Student" ADD CONSTRAINT "Student_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BackfillRequest" ADD CONSTRAINT "BackfillRequest_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BackfillWindow" ADD CONSTRAINT "BackfillWindow_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Replace indexes on Backfill (Prisma will sync; drop old if exist and create new)
DROP INDEX IF EXISTS "BackfillRequest_institutionId_status_idx";

CREATE INDEX "BackfillRequest_institutionId_entityId_status_idx" ON "BackfillRequest" ("institutionId", "entityId", "status");

CREATE INDEX "BackfillRequest_institutionId_status_idx" ON "BackfillRequest" ("institutionId", "status");

DROP INDEX IF EXISTS "BackfillWindow_institutionId_studentId_fromDate_toDate_idx";

CREATE INDEX "BackfillWindow_institutionId_entityId_studentId_fromDate_toDate_idx" ON "BackfillWindow" ("institutionId", "entityId", "studentId", "fromDate", "toDate");

CREATE INDEX "Student_institutionId_entityId_idx" ON "Student" ("institutionId", "entityId");
