ALTER TABLE "ElectionVoter" ADD COLUMN "ballotToken" TEXT;
ALTER TABLE "ElectionVoter" ADD COLUMN "ballotSignature" TEXT;
ALTER TABLE "ElectionVoter" ADD COLUMN "ballotExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "ElectionVoter_ballotToken_key" ON "ElectionVoter"("ballotToken");
