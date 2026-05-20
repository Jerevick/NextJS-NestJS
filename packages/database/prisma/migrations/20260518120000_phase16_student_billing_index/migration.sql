-- Phase 16: billing / status list queries on active students per entity
CREATE INDEX "Student_institutionId_entityId_enrollmentStatus_deletedAt_idx"
ON "Student" ("institutionId", "entityId", "enrollmentStatus", "deletedAt");
