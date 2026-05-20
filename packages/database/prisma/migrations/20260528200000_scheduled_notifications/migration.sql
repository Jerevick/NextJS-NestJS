-- Phase 14.1 scheduled notifications (BullMQ delayed delivery)
CREATE TYPE "ScheduledNotificationStatus" AS ENUM ('PENDING', 'SENT', 'CANCELLED', 'FAILED');
CREATE TYPE "ScheduledNotificationKind" AS ENUM ('SINGLE', 'BULK');

CREATE TABLE "ScheduledNotification" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT,
    "initiatedById" TEXT NOT NULL,
    "kind" "ScheduledNotificationKind" NOT NULL,
    "recipientId" TEXT,
    "event" TEXT,
    "payload" JSONB NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "ScheduledNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "bullJobId" TEXT,
    "sentAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScheduledNotification_institutionId_status_scheduledAt_idx" ON "ScheduledNotification"("institutionId", "status", "scheduledAt");
CREATE INDEX "ScheduledNotification_status_scheduledAt_idx" ON "ScheduledNotification"("status", "scheduledAt");

ALTER TABLE "ScheduledNotification" ADD CONSTRAINT "ScheduledNotification_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledNotification" ADD CONSTRAINT "ScheduledNotification_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduledNotification" ADD CONSTRAINT "ScheduledNotification_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduledNotification" ADD CONSTRAINT "ScheduledNotification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
