-- CreateEnum
CREATE TYPE "BackfillRequestStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "BackfillRequest" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "justification" TEXT NOT NULL,
    "billingAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "status" "BackfillRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackfillRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackfillWindow" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "backfillRequestId" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackfillWindow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackfillRequest_institutionId_studentId_idx" ON "BackfillRequest"("institutionId", "studentId");

-- CreateIndex
CREATE INDEX "BackfillRequest_institutionId_status_idx" ON "BackfillRequest"("institutionId", "status");

-- CreateIndex
CREATE INDEX "BackfillWindow_institutionId_studentId_fromDate_toDate_idx" ON "BackfillWindow"("institutionId", "studentId", "fromDate", "toDate");

-- AddForeignKey
ALTER TABLE "BackfillRequest" ADD CONSTRAINT "BackfillRequest_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackfillRequest" ADD CONSTRAINT "BackfillRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackfillWindow" ADD CONSTRAINT "BackfillWindow_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackfillWindow" ADD CONSTRAINT "BackfillWindow_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackfillWindow" ADD CONSTRAINT "BackfillWindow_backfillRequestId_fkey" FOREIGN KEY ("backfillRequestId") REFERENCES "BackfillRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
