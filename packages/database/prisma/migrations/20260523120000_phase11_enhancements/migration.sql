CREATE TYPE "ElectionScope" AS ENUM ('ENTITY', 'INSTITUTION');

ALTER TABLE "Election" ADD COLUMN "scope" "ElectionScope" NOT NULL DEFAULT 'ENTITY';
ALTER TABLE "Election" ADD COLUMN "workflowInstanceId" TEXT;
ALTER TABLE "Election" ADD COLUMN "votingNotifiedAt" TIMESTAMP(3);

ALTER TABLE "Meeting" ADD COLUMN "workflowInstanceId" TEXT;
ALTER TABLE "Meeting" ADD COLUMN "registrarFiledAt" TIMESTAMP(3);
ALTER TABLE "Meeting" ADD COLUMN "registrarFiledBy" TEXT;
