-- Phase 12 gaps: competition entries, awards, records, event payment status

CREATE TYPE "AlumniPaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'WAIVED');

ALTER TABLE "AlumniEventRegistration" ADD COLUMN IF NOT EXISTS "paymentStatus" "AlumniPaymentStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "AlumniEventRegistration" ADD COLUMN IF NOT EXISTS "paymentUrl" TEXT;

CREATE TABLE "SportsCompetitionEntry" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allEligible" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    CONSTRAINT "SportsCompetitionEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SportsCompetitionEntry_competitionId_teamId_key" ON "SportsCompetitionEntry"("competitionId", "teamId");
CREATE INDEX "SportsCompetitionEntry_institutionId_competitionId_idx" ON "SportsCompetitionEntry"("institutionId", "competitionId");

CREATE TABLE "SportsAward" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sportTypeId" TEXT,
    "teamId" TEXT,
    "playerId" TEXT,
    "academicYear" TEXT,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SportsAward_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SportsAward_institutionId_awardedAt_idx" ON "SportsAward"("institutionId", "awardedAt");

CREATE TABLE "SportsRecord" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "holderName" TEXT,
    "sportTypeId" TEXT,
    "setAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SportsRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SportsRecord_institutionId_category_idx" ON "SportsRecord"("institutionId", "category");

ALTER TABLE "SportsCompetitionEntry" ADD CONSTRAINT "SportsCompetitionEntry_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SportsCompetitionEntry" ADD CONSTRAINT "SportsCompetitionEntry_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "SportsCompetition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SportsCompetitionEntry" ADD CONSTRAINT "SportsCompetitionEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "SportsTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SportsAward" ADD CONSTRAINT "SportsAward_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SportsAward" ADD CONSTRAINT "SportsAward_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SportsRecord" ADD CONSTRAINT "SportsRecord_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SportsRecord" ADD CONSTRAINT "SportsRecord_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
