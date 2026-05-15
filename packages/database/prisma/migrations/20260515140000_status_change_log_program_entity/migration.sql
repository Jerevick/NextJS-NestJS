-- BillingImplication + immutable status audit trail (Phase 3.2)
CREATE TYPE "BillingImplication" AS ENUM ('GAIN', 'LOSS', 'RETROACTIVE_GAIN', 'NONE');

CREATE TABLE "StatusChangeLog" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fromStatus" "StudentEnrollmentStatusEnum" NOT NULL,
    "toStatus" "StudentEnrollmentStatusEnum" NOT NULL,
    "reason" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billingImplication" "BillingImplication" NOT NULL,

    CONSTRAINT "StatusChangeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StatusChangeLog_institutionId_entityId_studentId_recordedAt_idx" ON "StatusChangeLog" ("institutionId", "entityId", "studentId", "recordedAt");

CREATE INDEX "StatusChangeLog_institutionId_studentId_recordedAt_idx" ON "StatusChangeLog" ("institutionId", "studentId", "recordedAt");

ALTER TABLE "StatusChangeLog" ADD CONSTRAINT "StatusChangeLog_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StatusChangeLog" ADD CONSTRAINT "StatusChangeLog_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StatusChangeLog" ADD CONSTRAINT "StatusChangeLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StatusChangeLog" ADD CONSTRAINT "StatusChangeLog_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Session invalidation counter (instant logout on inactivation — Phase 3.2 baseline)
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- Dual-scope programs: align with student entity (defaults to MAIN campus)
ALTER TABLE "Program" ADD COLUMN "entityId" TEXT;

UPDATE "Program" p
SET "entityId" = e."id"
FROM "InstitutionEntity" e
WHERE e."institutionId" = p."institutionId" AND e."code" = 'MAIN';

ALTER TABLE "Program" ALTER COLUMN "entityId" SET NOT NULL;

ALTER TABLE "Program" ADD CONSTRAINT "Program_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Program_institutionId_entityId_idx" ON "Program" ("institutionId", "entityId");
