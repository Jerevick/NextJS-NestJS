-- Dual-scope courses and sections (align with program / student entity)
ALTER TABLE "Course" ADD COLUMN "entityId" TEXT;

UPDATE "Course" c
SET "entityId" = (
  SELECT e."id"
  FROM "InstitutionEntity" e
  WHERE e."institutionId" = c."institutionId"
    AND e."code" = 'MAIN'
    AND e."deletedAt" IS NULL
  ORDER BY e."createdAt" ASC
  LIMIT 1
);

ALTER TABLE "Course" ALTER COLUMN "entityId" SET NOT NULL;

ALTER TABLE "Course"
  ADD CONSTRAINT "Course_entityId_fkey"
  FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Course_institutionId_entityId_idx" ON "Course" ("institutionId", "entityId");

ALTER TABLE "Section" ADD COLUMN "entityId" TEXT;

UPDATE "Section" s
SET "entityId" = c."entityId"
FROM "Course" c
WHERE c."id" = s."courseId";

ALTER TABLE "Section" ALTER COLUMN "entityId" SET NOT NULL;

ALTER TABLE "Section"
  ADD CONSTRAINT "Section_entityId_fkey"
  FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Section_institutionId_entityId_idx" ON "Section" ("institutionId", "entityId");
