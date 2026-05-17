-- Phase 19 — Academic progression (prompt 19.1): rules, immutable decisions, holds,
-- carryover/resit links, session attempts, repeat metadata on enrollments.

CREATE TYPE "GpaRepeatPolicy" AS ENUM ('BEST_OF_ATTEMPTS', 'LAST_ATTEMPT', 'ALL_ATTEMPTS_AVERAGE', 'FIRST_ATTEMPT_ONLY');
CREATE TYPE "ProgressionRuleScope" AS ENUM ('INSTITUTION', 'PROGRAM');
CREATE TYPE "ProgressionDecisionKind" AS ENUM ('PROMOTION', 'REPEAT_OUTCOME', 'DEFERRED_PROMOTION', 'MANUAL_PROMOTION');
CREATE TYPE "ProgressionPromotionSubtype" AS ENUM ('AUTOMATIC', 'CONDITIONAL', 'DEFERRED', 'MANUAL');
CREATE TYPE "ProgressionRepeatSubtype" AS ENUM ('FULL_REPEAT', 'SUPPLEMENTARY_CARRYOVER', 'RESIT', 'DEFERRED_EXAMINATION', 'AEGROTAT');
CREATE TYPE "StudentSessionRepeatReason" AS ENUM ('NONE', 'FULL_REPEAT', 'CARRYOVER', 'RESIT_CONTEXT', 'RUSTICATION_RETURN', 'OTHER');
CREATE TYPE "StudentProgressionHoldType" AS ENUM ('FINANCIAL', 'ACADEMIC', 'ADMINISTRATIVE', 'LIBRARY', 'DISCIPLINARY', 'OTHER');

ALTER TABLE "StudentEnrollment" ADD COLUMN "originalSemesterId" TEXT,
ADD COLUMN "enrollmentAttemptNumber" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "StudentEnrollment" ADD CONSTRAINT "StudentEnrollment_originalSemesterId_fkey"
  FOREIGN KEY ("originalSemesterId") REFERENCES "Semester"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "StudentEnrollment_originalSemesterId_idx" ON "StudentEnrollment"("originalSemesterId");

CREATE TABLE "ProgressionRule" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "ruleScope" "ProgressionRuleScope" NOT NULL,
    "programId" TEXT,
    "minGpaPromotion" DECIMAL(4,2),
    "conditionalPromotionMinGpa" DECIMAL(4,2),
    "maxCarryoverCourses" INTEGER NOT NULL DEFAULT 2,
    "maxRepeatAttemptsPerLevel" INTEGER NOT NULL DEFAULT 2,
    "maxProgrammeDurationYears" INTEGER,
    "maxResitAttempts" INTEGER NOT NULL DEFAULT 1,
    "resitGradeCapPercent" DECIMAL(5,2) NOT NULL DEFAULT 40,
    "gpaRepeatPolicy" "GpaRepeatPolicy" NOT NULL DEFAULT 'BEST_OF_ATTEMPTS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ProgressionRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProgressionRule_institutionId_idx" ON "ProgressionRule"("institutionId");
CREATE INDEX "ProgressionRule_institutionId_programId_idx" ON "ProgressionRule"("institutionId", "programId");

ALTER TABLE "ProgressionRule" ADD CONSTRAINT "ProgressionRule_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProgressionRule" ADD CONSTRAINT "ProgressionRule_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ProgressionRule_institution_default_unique"
  ON "ProgressionRule"("institutionId") WHERE "ruleScope" = 'INSTITUTION' AND "deletedAt" IS NULL;

CREATE UNIQUE INDEX "ProgressionRule_institution_program_unique"
  ON "ProgressionRule"("institutionId", "programId") WHERE "ruleScope" = 'PROGRAM' AND "deletedAt" IS NULL;

CREATE TABLE "ProgressionDecision" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "kind" "ProgressionDecisionKind" NOT NULL,
    "promotionSubtype" "ProgressionPromotionSubtype",
    "repeatSubtype" "ProgressionRepeatSubtype",
    "semesterId" TEXT,
    "academicYearId" TEXT,
    "priorDecisionId" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressionDecision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProgressionDecision_institutionId_studentId_createdAt_idx"
  ON "ProgressionDecision"("institutionId", "studentId", "createdAt");
CREATE INDEX "ProgressionDecision_studentId_idx" ON "ProgressionDecision"("studentId");

ALTER TABLE "ProgressionDecision" ADD CONSTRAINT "ProgressionDecision_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgressionDecision" ADD CONSTRAINT "ProgressionDecision_entityId_fkey"
  FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgressionDecision" ADD CONSTRAINT "ProgressionDecision_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgressionDecision" ADD CONSTRAINT "ProgressionDecision_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgressionDecision" ADD CONSTRAINT "ProgressionDecision_semesterId_fkey"
  FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgressionDecision" ADD CONSTRAINT "ProgressionDecision_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgressionDecision" ADD CONSTRAINT "ProgressionDecision_priorDecisionId_fkey"
  FOREIGN KEY ("priorDecisionId") REFERENCES "ProgressionDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgressionDecision" ADD CONSTRAINT "ProgressionDecision_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StudentProgressionHold" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "StudentProgressionHoldType" NOT NULL,
    "reason" TEXT,
    "semesterId" TEXT,
    "clearedAt" TIMESTAMP(3),
    "placedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentProgressionHold_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudentProgressionHold_institutionId_studentId_idx" ON "StudentProgressionHold"("institutionId", "studentId");
CREATE INDEX "StudentProgressionHold_studentId_clearedAt_idx" ON "StudentProgressionHold"("studentId", "clearedAt");

ALTER TABLE "StudentProgressionHold" ADD CONSTRAINT "StudentProgressionHold_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentProgressionHold" ADD CONSTRAINT "StudentProgressionHold_entityId_fkey"
  FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentProgressionHold" ADD CONSTRAINT "StudentProgressionHold_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentProgressionHold" ADD CONSTRAINT "StudentProgressionHold_semesterId_fkey"
  FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentProgressionHold" ADD CONSTRAINT "StudentProgressionHold_placedByUserId_fkey"
  FOREIGN KEY ("placedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CarryoverEnrollment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "originalEnrollmentId" TEXT NOT NULL,
    "repeatEnrollmentId" TEXT NOT NULL,

    CONSTRAINT "CarryoverEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CarryoverEnrollment_originalEnrollmentId_key" ON "CarryoverEnrollment"("originalEnrollmentId");
CREATE UNIQUE INDEX "CarryoverEnrollment_repeatEnrollmentId_key" ON "CarryoverEnrollment"("repeatEnrollmentId");
CREATE INDEX "CarryoverEnrollment_institutionId_idx" ON "CarryoverEnrollment"("institutionId");

ALTER TABLE "CarryoverEnrollment" ADD CONSTRAINT "CarryoverEnrollment_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CarryoverEnrollment" ADD CONSTRAINT "CarryoverEnrollment_originalEnrollmentId_fkey"
  FOREIGN KEY ("originalEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CarryoverEnrollment" ADD CONSTRAINT "CarryoverEnrollment_repeatEnrollmentId_fkey"
  FOREIGN KEY ("repeatEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ResitRecord" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "gradeCapPercent" DECIMAL(5,2) NOT NULL,
    "capApplied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResitRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResitRecord_enrollmentId_key" ON "ResitRecord"("enrollmentId");
CREATE INDEX "ResitRecord_institutionId_idx" ON "ResitRecord"("institutionId");

ALTER TABLE "ResitRecord" ADD CONSTRAINT "ResitRecord_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResitRecord" ADD CONSTRAINT "ResitRecord_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StudentAcademicSessionRecord" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "studyLevel" INTEGER NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "repeatReason" "StudentSessionRepeatReason" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAcademicSessionRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentAcademicSessionRecord_studentId_programId_academicYearId_studyLevel_attemptNumber_key"
  ON "StudentAcademicSessionRecord"("studentId", "programId", "academicYearId", "studyLevel", "attemptNumber");

CREATE INDEX "StudentAcademicSessionRecord_institutionId_idx" ON "StudentAcademicSessionRecord"("institutionId");

ALTER TABLE "StudentAcademicSessionRecord" ADD CONSTRAINT "StudentAcademicSessionRecord_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentAcademicSessionRecord" ADD CONSTRAINT "StudentAcademicSessionRecord_entityId_fkey"
  FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentAcademicSessionRecord" ADD CONSTRAINT "StudentAcademicSessionRecord_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentAcademicSessionRecord" ADD CONSTRAINT "StudentAcademicSessionRecord_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentAcademicSessionRecord" ADD CONSTRAINT "StudentAcademicSessionRecord_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
