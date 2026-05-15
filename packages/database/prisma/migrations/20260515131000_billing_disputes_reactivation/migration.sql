-- CreateEnum
CREATE TYPE "BillingDisputeStatus" AS ENUM ('OPEN', 'MANUAL_REVIEW', 'AUTO_RESOLVED_REJECTED', 'AUTO_RESOLVED_ACCEPTED', 'RESOLVED_ACCEPTED', 'RESOLVED_REJECTED');

-- CreateEnum
CREATE TYPE "ReactivationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "BillingDispute" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "status" "BillingDisputeStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT NOT NULL,
    "lines" JSONB NOT NULL DEFAULT '[]',
    "resolutionNotes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BillingDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReactivationRequest" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "status" "ReactivationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNotes" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReactivationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillingDispute_institutionId_idx" ON "BillingDispute"("institutionId");

-- CreateIndex
CREATE INDEX "BillingDispute_invoiceId_idx" ON "BillingDispute"("invoiceId");

-- CreateIndex
CREATE INDEX "ReactivationRequest_institutionId_status_idx" ON "ReactivationRequest"("institutionId", "status");

-- CreateIndex
CREATE INDEX "ReactivationRequest_institutionId_studentId_idx" ON "ReactivationRequest"("institutionId", "studentId");

-- AddForeignKey
ALTER TABLE "BillingDispute" ADD CONSTRAINT "BillingDispute_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDispute" ADD CONSTRAINT "BillingDispute_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingDispute" ADD CONSTRAINT "BillingDispute_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReactivationRequest" ADD CONSTRAINT "ReactivationRequest_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReactivationRequest" ADD CONSTRAINT "ReactivationRequest_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReactivationRequest" ADD CONSTRAINT "ReactivationRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReactivationRequest" ADD CONSTRAINT "ReactivationRequest_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReactivationRequest" ADD CONSTRAINT "ReactivationRequest_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
