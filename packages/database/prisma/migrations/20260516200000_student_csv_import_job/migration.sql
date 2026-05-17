-- CreateTable
CREATE TABLE "StudentCsvImportJob" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT,
    "initiatedById" TEXT NOT NULL,
    "status" "BulkEnrollmentJobStatus" NOT NULL DEFAULT 'QUEUED',
    "csvText" TEXT NOT NULL,
    "results" JSONB NOT NULL DEFAULT '[]',
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "StudentCsvImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentCsvImportJob_institutionId_status_idx" ON "StudentCsvImportJob"("institutionId", "status");

-- CreateIndex
CREATE INDEX "StudentCsvImportJob_initiatedById_idx" ON "StudentCsvImportJob"("initiatedById");

-- AddForeignKey
ALTER TABLE "StudentCsvImportJob" ADD CONSTRAINT "StudentCsvImportJob_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCsvImportJob" ADD CONSTRAINT "StudentCsvImportJob_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
