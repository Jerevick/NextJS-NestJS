-- AlterTable
ALTER TABLE "Student" ADD COLUMN "graduationConfirmedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Document" ADD COLUMN "verificationCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Document_verificationCode_key" ON "Document"("verificationCode");
