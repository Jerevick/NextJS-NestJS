-- CreateEnum
CREATE TYPE "FinanceBulkChargeJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "FinanceBulkChargeJob" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "FinanceBulkChargeJobStatus" NOT NULL DEFAULT 'QUEUED',
    "results" JSONB NOT NULL DEFAULT '[]',
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "FinanceBulkChargeJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceBulkChargeJob_institutionId_status_idx" ON "FinanceBulkChargeJob"("institutionId", "status");

-- CreateIndex
CREATE INDEX "FinanceBulkChargeJob_initiatedById_idx" ON "FinanceBulkChargeJob"("initiatedById");

-- AddForeignKey
ALTER TABLE "FinanceBulkChargeJob" ADD CONSTRAINT "FinanceBulkChargeJob_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBulkChargeJob" ADD CONSTRAINT "FinanceBulkChargeJob_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBulkChargeJob" ADD CONSTRAINT "FinanceBulkChargeJob_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBulkChargeJob" ADD CONSTRAINT "FinanceBulkChargeJob_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
