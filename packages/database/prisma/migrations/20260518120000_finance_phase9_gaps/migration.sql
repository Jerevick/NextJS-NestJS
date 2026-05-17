-- Phase 9 gaps: scholarship application workflow + transaction metadata (ledger pairs)
ALTER TABLE "FinanceScholarshipApplication" ADD COLUMN IF NOT EXISTS "workflowInstanceId" TEXT;

ALTER TABLE "FinanceTransaction" ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "FinanceScholarshipApplication_workflowInstanceId_idx"
  ON "FinanceScholarshipApplication"("workflowInstanceId");
