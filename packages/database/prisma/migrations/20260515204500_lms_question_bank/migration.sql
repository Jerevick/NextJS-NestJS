-- CreateTable
CREATE TABLE "LmsQuestionBank" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LmsQuestionBank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LmsQuestionBankItem" (
    "id" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "type" "LmsQuestionType" NOT NULL DEFAULT 'MCQ',
    "content" JSONB NOT NULL DEFAULT '{}',
    "points" INTEGER NOT NULL DEFAULT 1,
    "explanation" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "difficulty" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LmsQuestionBankItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LmsQuestionBank_institutionId_idx" ON "LmsQuestionBank"("institutionId");

-- CreateIndex
CREATE INDEX "LmsQuestionBank_institutionId_deletedAt_idx" ON "LmsQuestionBank"("institutionId", "deletedAt");

-- CreateIndex
CREATE INDEX "LmsQuestionBankItem_institutionId_idx" ON "LmsQuestionBankItem"("institutionId");

-- CreateIndex
CREATE INDEX "LmsQuestionBankItem_bankId_sortOrder_idx" ON "LmsQuestionBankItem"("bankId", "sortOrder");

-- AddForeignKey
ALTER TABLE "LmsQuestionBank" ADD CONSTRAINT "LmsQuestionBank_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsQuestionBankItem" ADD CONSTRAINT "LmsQuestionBankItem_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "LmsQuestionBank"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsQuestionBankItem" ADD CONSTRAINT "LmsQuestionBankItem_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
