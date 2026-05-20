-- Phase 18: Integrations marketplace, outbound webhooks, public API keys

CREATE TABLE "InstitutionIntegration" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT,
    "code" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "configuredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "InstitutionIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstitutionIntegration_institutionId_entityId_code_key"
    ON "InstitutionIntegration"("institutionId", "entityId", "code");
CREATE INDEX "InstitutionIntegration_institutionId_idx" ON "InstitutionIntegration"("institutionId");
CREATE INDEX "InstitutionIntegration_institutionId_entityId_idx" ON "InstitutionIntegration"("institutionId", "entityId");

ALTER TABLE "InstitutionIntegration" ADD CONSTRAINT "InstitutionIntegration_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstitutionIntegration" ADD CONSTRAINT "InstitutionIntegration_entityId_fkey"
    FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "InstitutionWebhook" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT,
    "event" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "InstitutionWebhook_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InstitutionWebhook_institutionId_idx" ON "InstitutionWebhook"("institutionId");
CREATE INDEX "InstitutionWebhook_institutionId_event_idx" ON "InstitutionWebhook"("institutionId", "event");
CREATE INDEX "InstitutionWebhook_institutionId_entityId_idx" ON "InstitutionWebhook"("institutionId", "entityId");

ALTER TABLE "InstitutionWebhook" ADD CONSTRAINT "InstitutionWebhook_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstitutionWebhook" ADD CONSTRAINT "InstitutionWebhook_entityId_fkey"
    FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "InstitutionWebhookDelivery" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "statusCode" INTEGER,
    "responseBody" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstitutionWebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InstitutionWebhookDelivery_webhookId_idx" ON "InstitutionWebhookDelivery"("webhookId");
CREATE INDEX "InstitutionWebhookDelivery_institutionId_createdAt_idx"
    ON "InstitutionWebhookDelivery"("institutionId", "createdAt");

ALTER TABLE "InstitutionWebhookDelivery" ADD CONSTRAINT "InstitutionWebhookDelivery_webhookId_fkey"
    FOREIGN KEY ("webhookId") REFERENCES "InstitutionWebhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InstitutionWebhookDelivery" ADD CONSTRAINT "InstitutionWebhookDelivery_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PublicApiKey" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT,
    "name" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 60,
    "apiKeyLookup" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublicApiKey_apiKeyLookup_key" ON "PublicApiKey"("apiKeyLookup");
CREATE INDEX "PublicApiKey_institutionId_idx" ON "PublicApiKey"("institutionId");
CREATE INDEX "PublicApiKey_institutionId_entityId_idx" ON "PublicApiKey"("institutionId", "entityId");

ALTER TABLE "PublicApiKey" ADD CONSTRAINT "PublicApiKey_institutionId_fkey"
    FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicApiKey" ADD CONSTRAINT "PublicApiKey_entityId_fkey"
    FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
