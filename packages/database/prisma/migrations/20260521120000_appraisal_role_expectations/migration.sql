-- Staff appraisal: snapshot of duties & responsibilities for the review period
ALTER TABLE "StaffAppraisal" ADD COLUMN IF NOT EXISTS "roleExpectations" JSONB NOT NULL DEFAULT '{}';
