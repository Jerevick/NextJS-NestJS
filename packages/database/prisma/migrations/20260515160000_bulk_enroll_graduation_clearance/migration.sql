-- CreateEnum
CREATE TYPE "BulkEnrollmentJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "GraduationClearanceStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'CLEARED', 'REJECTED');

-- CreateTable
CREATE TABLE "BulkEnrollmentJob" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT,
    "sectionId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "waitlistIfFull" BOOLEAN NOT NULL DEFAULT false,
    "status" "BulkEnrollmentJobStatus" NOT NULL DEFAULT 'QUEUED',
    "studentIds" JSONB NOT NULL,
    "results" JSONB NOT NULL DEFAULT '[]',
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BulkEnrollmentJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraduationClearanceRequest" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "justification" TEXT,
    "status" "GraduationClearanceStatus" NOT NULL DEFAULT 'PENDING',
    "workflowInstanceId" TEXT,
    "departmentChecks" JSONB NOT NULL DEFAULT '[]',
    "reviewNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GraduationClearanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulkEnrollmentJob_institutionId_status_idx" ON "BulkEnrollmentJob"("institutionId", "status");

-- CreateIndex
CREATE INDEX "BulkEnrollmentJob_initiatedById_idx" ON "BulkEnrollmentJob"("initiatedById");

-- CreateIndex
CREATE INDEX "GraduationClearanceRequest_institutionId_status_idx" ON "GraduationClearanceRequest"("institutionId", "status");

-- CreateIndex
CREATE INDEX "GraduationClearanceRequest_institutionId_studentId_idx" ON "GraduationClearanceRequest"("institutionId", "studentId");

-- AddForeignKey
ALTER TABLE "BulkEnrollmentJob" ADD CONSTRAINT "BulkEnrollmentJob_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkEnrollmentJob" ADD CONSTRAINT "BulkEnrollmentJob_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationClearanceRequest" ADD CONSTRAINT "GraduationClearanceRequest_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationClearanceRequest" ADD CONSTRAINT "GraduationClearanceRequest_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationClearanceRequest" ADD CONSTRAINT "GraduationClearanceRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationClearanceRequest" ADD CONSTRAINT "GraduationClearanceRequest_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
