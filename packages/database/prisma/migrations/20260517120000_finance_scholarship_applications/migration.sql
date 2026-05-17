-- CreateEnum
CREATE TYPE "FinanceScholarshipApplicationStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "FinanceScholarshipApplication" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "scholarshipId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "responses" JSONB NOT NULL DEFAULT '{}',
    "status" "FinanceScholarshipApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceScholarshipApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceScholarshipApplication_scholarshipId_studentId_key" ON "FinanceScholarshipApplication"("scholarshipId", "studentId");

-- CreateIndex
CREATE INDEX "FinanceScholarshipApplication_institutionId_status_idx" ON "FinanceScholarshipApplication"("institutionId", "status");

-- AddForeignKey
ALTER TABLE "FinanceScholarshipApplication" ADD CONSTRAINT "FinanceScholarshipApplication_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceScholarshipApplication" ADD CONSTRAINT "FinanceScholarshipApplication_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceScholarshipApplication" ADD CONSTRAINT "FinanceScholarshipApplication_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "FinanceScholarship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceScholarshipApplication" ADD CONSTRAINT "FinanceScholarshipApplication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
