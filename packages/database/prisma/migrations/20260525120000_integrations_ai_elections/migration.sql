-- Meeting conference + calendar sync IDs
ALTER TABLE "Meeting" ADD COLUMN "zoomMeetingId" TEXT;
ALTER TABLE "Meeting" ADD COLUMN "googleCalendarEventId" TEXT;
ALTER TABLE "Meeting" ADD COLUMN "microsoftCalendarEventId" TEXT;

-- RSA blind-signature booth fields
ALTER TABLE "ElectionVoter" ADD COLUMN "ballotCommitment" TEXT;
ALTER TABLE "ElectionVoter" ADD COLUMN "blindRsaSignature" TEXT;
CREATE UNIQUE INDEX "ElectionVoter_ballotCommitment_key" ON "ElectionVoter"("ballotCommitment");

-- Phase 13 RAG embeddings (JSON vector; upgrade to pgvector in production)
CREATE TABLE "EmbeddingDocument" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "embedding" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmbeddingDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmbeddingDocument_institutionId_entityId_sourceType_idx" ON "EmbeddingDocument"("institutionId", "entityId", "sourceType");
CREATE UNIQUE INDEX "EmbeddingDocument_institutionId_sourceType_sourceId_key" ON "EmbeddingDocument"("institutionId", "sourceType", "sourceId");

ALTER TABLE "EmbeddingDocument" ADD CONSTRAINT "EmbeddingDocument_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
