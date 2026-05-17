-- CreateEnum
CREATE TYPE "FinanceTransactionType" AS ENUM ('CHARGE', 'PAYMENT', 'SCHOLARSHIP_CREDIT', 'REFUND', 'ADJUSTMENT', 'WAIVER');

-- CreateEnum
CREATE TYPE "FinanceTransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FinancePaymentPlanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DEFAULTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FinanceScholarshipType" AS ENUM ('MERIT', 'NEED_BASED', 'ATHLETIC', 'SPONSORED', 'OTHER');

-- CreateEnum
CREATE TYPE "FinanceAwardStatus" AS ENUM ('PENDING', 'APPROVED', 'DISBURSED', 'REVOKED');

-- CreateTable
CREATE TABLE "FeeStructure" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "programmeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "items" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FeeStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAccount" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "lastTransactionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceTransaction" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "studentAccountId" TEXT NOT NULL,
    "type" "FinanceTransactionType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "gatewayRef" TEXT,
    "gatewayResponse" JSONB,
    "status" "FinanceTransactionStatus" NOT NULL,
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "approvedBy" TEXT,
    "approvalWorkflowId" TEXT,
    "isReversed" BOOLEAN NOT NULL DEFAULT false,
    "reversedTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancePaymentPlan" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "studentAccountId" TEXT NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "installments" JSONB NOT NULL DEFAULT '[]',
    "status" "FinancePaymentPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancePaymentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceScholarship" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinanceScholarshipType" NOT NULL,
    "fundingSource" TEXT NOT NULL,
    "totalFund" DECIMAL(14,2) NOT NULL,
    "disbursedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "applicationSchemaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FinanceScholarship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceScholarshipAward" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "scholarshipId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "status" "FinanceAwardStatus" NOT NULL DEFAULT 'PENDING',
    "workflowInstanceId" TEXT,
    "awardedBy" TEXT,
    "disbursedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceScholarshipAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceBankIntegration" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "webhookSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceBankIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentAccount_studentId_key" ON "StudentAccount"("studentId");

-- CreateIndex
CREATE INDEX "FeeStructure_institutionId_entityId_idx" ON "FeeStructure"("institutionId", "entityId");

-- CreateIndex
CREATE INDEX "FeeStructure_institutionId_academicYearId_idx" ON "FeeStructure"("institutionId", "academicYearId");

-- CreateIndex
CREATE INDEX "StudentAccount_institutionId_entityId_idx" ON "StudentAccount"("institutionId", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceTransaction_reference_key" ON "FinanceTransaction"("reference");

-- CreateIndex
CREATE INDEX "FinanceTransaction_institutionId_studentAccountId_createdAt_idx" ON "FinanceTransaction"("institutionId", "studentAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "FinanceTransaction_institutionId_entityId_idx" ON "FinanceTransaction"("institutionId", "entityId");

-- CreateIndex
CREATE INDEX "FinancePaymentPlan_institutionId_studentAccountId_idx" ON "FinancePaymentPlan"("institutionId", "studentAccountId");

-- CreateIndex
CREATE INDEX "FinanceScholarship_institutionId_entityId_idx" ON "FinanceScholarship"("institutionId", "entityId");

-- CreateIndex
CREATE INDEX "FinanceScholarshipAward_institutionId_studentId_idx" ON "FinanceScholarshipAward"("institutionId", "studentId");

-- CreateIndex
CREATE INDEX "FinanceScholarshipAward_scholarshipId_idx" ON "FinanceScholarshipAward"("scholarshipId");

-- CreateIndex
CREATE INDEX "FinanceBankIntegration_institutionId_entityId_provider_idx" ON "FinanceBankIntegration"("institutionId", "entityId", "provider");

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAccount" ADD CONSTRAINT "StudentAccount_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAccount" ADD CONSTRAINT "StudentAccount_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAccount" ADD CONSTRAINT "StudentAccount_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_studentAccountId_fkey" FOREIGN KEY ("studentAccountId") REFERENCES "StudentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePaymentPlan" ADD CONSTRAINT "FinancePaymentPlan_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePaymentPlan" ADD CONSTRAINT "FinancePaymentPlan_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePaymentPlan" ADD CONSTRAINT "FinancePaymentPlan_studentAccountId_fkey" FOREIGN KEY ("studentAccountId") REFERENCES "StudentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceScholarship" ADD CONSTRAINT "FinanceScholarship_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceScholarship" ADD CONSTRAINT "FinanceScholarship_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceScholarshipAward" ADD CONSTRAINT "FinanceScholarshipAward_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceScholarshipAward" ADD CONSTRAINT "FinanceScholarshipAward_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceScholarshipAward" ADD CONSTRAINT "FinanceScholarshipAward_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "FinanceScholarship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceScholarshipAward" ADD CONSTRAINT "FinanceScholarshipAward_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceScholarshipAward" ADD CONSTRAINT "FinanceScholarshipAward_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBankIntegration" ADD CONSTRAINT "FinanceBankIntegration_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceBankIntegration" ADD CONSTRAINT "FinanceBankIntegration_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
