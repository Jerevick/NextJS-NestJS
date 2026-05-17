-- Institution billing fields (schema drift — added to Prisma without prior migration)
ALTER TABLE "Institution" ADD COLUMN IF NOT EXISTS "minimumBillableCount" INTEGER;
ALTER TABLE "Institution" ADD COLUMN IF NOT EXISTS "billingDayOfMonth" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Institution" ADD COLUMN IF NOT EXISTS "disputeWindowDays" INTEGER NOT NULL DEFAULT 14;
