-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "lockedAt" TIMESTAMP(3),
ADD COLUMN "isRetroactive" BOOLEAN NOT NULL DEFAULT false;
