-- AlterTable
ALTER TABLE "LmsSubmission" ADD COLUMN "attemptNumber" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "LmsSubmission" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "LmsSubmission" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "LmsSubmission_assessmentId_studentId_attemptNumber_idx" ON "LmsSubmission"("assessmentId", "studentId", "attemptNumber");
