-- CreateTable
CREATE TABLE "MonthlyBillableSummary" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "peakDailyCount" INTEGER NOT NULL,
    "averageDailyCount" DECIMAL(14,4) NOT NULL,
    "watermarkCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyBillableSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyBillableSummary_institutionId_entityId_year_month_key" ON "MonthlyBillableSummary"("institutionId", "entityId", "year", "month");

-- CreateIndex
CREATE INDEX "MonthlyBillableSummary_institutionId_year_month_idx" ON "MonthlyBillableSummary"("institutionId", "year", "month");

-- AddForeignKey
ALTER TABLE "MonthlyBillableSummary" ADD CONSTRAINT "MonthlyBillableSummary_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyBillableSummary" ADD CONSTRAINT "MonthlyBillableSummary_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
