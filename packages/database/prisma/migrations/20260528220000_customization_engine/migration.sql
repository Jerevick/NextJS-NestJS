-- Phase 14.2 — customization engine (custom forms + submissions)

CREATE TYPE "CustomFormType" AS ENUM ('APPLICATION', 'SCHOLARSHIP', 'SURVEY', 'FEEDBACK');
CREATE TYPE "CustomFormStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "CustomForm" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT,
    "formType" "CustomFormType" NOT NULL,
    "status" "CustomFormStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "schema" JSONB NOT NULL DEFAULT '{}',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CustomForm_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT,
    "formId" TEXT NOT NULL,
    "submittedById" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomForm_institutionId_idx" ON "CustomForm"("institutionId");
CREATE INDEX "CustomForm_institutionId_entityId_idx" ON "CustomForm"("institutionId", "entityId");
CREATE INDEX "CustomForm_institutionId_formType_status_idx" ON "CustomForm"("institutionId", "formType", "status");

CREATE INDEX "FormSubmission_institutionId_idx" ON "FormSubmission"("institutionId");
CREATE INDEX "FormSubmission_formId_idx" ON "FormSubmission"("formId");
CREATE INDEX "FormSubmission_formId_createdAt_idx" ON "FormSubmission"("formId", "createdAt");

ALTER TABLE "CustomForm" ADD CONSTRAINT "CustomForm_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomForm" ADD CONSTRAINT "CustomForm_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "CustomForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
