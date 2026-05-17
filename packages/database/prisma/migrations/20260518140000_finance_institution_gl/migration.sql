-- Institution GL chart + journal lines (Phase 9)

CREATE TYPE "FinanceGlAccountType" AS ENUM ('ASSET', 'LIABILITY', 'REVENUE', 'EXPENSE');
CREATE TYPE "FinanceGlNormalBalance" AS ENUM ('DEBIT', 'CREDIT');

CREATE TABLE "FinanceGlAccount" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinanceGlAccountType" NOT NULL,
    "normalBalance" "FinanceGlNormalBalance" NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceGlAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinanceGlJournalLine" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "financeTransactionId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL,
    "credit" DECIMAL(14,2) NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceGlJournalLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinanceGlAccount_institutionId_code_key" ON "FinanceGlAccount"("institutionId", "code");
CREATE INDEX "FinanceGlAccount_institutionId_isActive_idx" ON "FinanceGlAccount"("institutionId", "isActive");

CREATE INDEX "FinanceGlJournalLine_institutionId_financeTransactionId_idx" ON "FinanceGlJournalLine"("institutionId", "financeTransactionId");
CREATE INDEX "FinanceGlJournalLine_institutionId_accountCode_postedAt_idx" ON "FinanceGlJournalLine"("institutionId", "accountCode", "postedAt");

ALTER TABLE "FinanceGlAccount" ADD CONSTRAINT "FinanceGlAccount_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinanceGlJournalLine" ADD CONSTRAINT "FinanceGlJournalLine_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceGlJournalLine" ADD CONSTRAINT "FinanceGlJournalLine_financeTransactionId_fkey" FOREIGN KEY ("financeTransactionId") REFERENCES "FinanceTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
