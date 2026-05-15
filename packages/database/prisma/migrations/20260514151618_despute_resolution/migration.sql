-- AlterTable
ALTER TABLE "AffiliatePartner" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "BillingDispute" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MonthlyBillableSummary" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ReactivationRequest" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "BackfillWindow_institutionId_entityId_studentId_fromDate_toDate" RENAME TO "BackfillWindow_institutionId_entityId_studentId_fromDate_to_idx";
