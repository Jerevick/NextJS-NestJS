-- Phase 14: Notification engine — templates + multi-channel metadata

CREATE TYPE "NotificationPriority" AS ENUM ('HIGH', 'NORMAL', 'LOW');

CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT,
    "entityId" TEXT,
    "event" TEXT NOT NULL,
    "channels" JSONB NOT NULL DEFAULT '{"email":true,"inApp":true}',
    "subject" TEXT,
    "htmlBody" TEXT,
    "textBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificationTemplate_institutionId_entityId_event_idx" ON "NotificationTemplate"("institutionId", "entityId", "event");

ALTER TABLE "UserNotification" ADD COLUMN IF NOT EXISTS "entityId" TEXT;
ALTER TABLE "UserNotification" ADD COLUMN IF NOT EXISTS "event" TEXT;
ALTER TABLE "UserNotification" ADD COLUMN IF NOT EXISTS "channels" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "UserNotification" ADD COLUMN IF NOT EXISTS "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL';

CREATE INDEX "UserNotification_institutionId_event_idx" ON "UserNotification"("institutionId", "event");

ALTER TABLE "NotificationTemplate" ADD CONSTRAINT "NotificationTemplate_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationTemplate" ADD CONSTRAINT "NotificationTemplate_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
