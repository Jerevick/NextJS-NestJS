-- Forward migration for AgendaItem soft delete.
-- The original same-timestamp migration is a no-op because it sorted before
-- the migration that creates AgendaItem.

ALTER TABLE "AgendaItem" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "AgendaItem_meetingId_deletedAt_idx" ON "AgendaItem"("meetingId", "deletedAt");
