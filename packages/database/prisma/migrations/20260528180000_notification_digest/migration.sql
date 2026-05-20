-- Phase 14.1 digest mode: buffer LOW-priority outbound notifications
CREATE TABLE "NotificationDigestEntry" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subject" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "htmlBody" TEXT,
    "textBody" TEXT,
    "actionUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDigestEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificationDigestEntry_userId_createdAt_idx" ON "NotificationDigestEntry"("userId", "createdAt");
CREATE INDEX "NotificationDigestEntry_institutionId_userId_idx" ON "NotificationDigestEntry"("institutionId", "userId");

ALTER TABLE "NotificationDigestEntry" ADD CONSTRAINT "NotificationDigestEntry_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDigestEntry" ADD CONSTRAINT "NotificationDigestEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
