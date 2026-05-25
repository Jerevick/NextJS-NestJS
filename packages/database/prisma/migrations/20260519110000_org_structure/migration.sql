-- Org structure (idempotent because some cloud databases already have these tables).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrgUnitType') THEN
    CREATE TYPE "OrgUnitType" AS ENUM (
      'INSTITUTION',
      'FACULTY',
      'DEPARTMENT',
      'PROGRAMME',
      'ADMIN_UNIT',
      'COMMITTEE',
      'LIBRARY',
      'HOSTEL',
      'STUDENT_UNION',
      'SPORTS_UNIT'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PositionScope') THEN
    CREATE TYPE "PositionScope" AS ENUM (
      'INSTITUTION',
      'ENTITY',
      'FACULTY',
      'DEPARTMENT',
      'PROGRAMME',
      'UNIT',
      'SECTION',
      'PERSONAL'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "OrgUnit" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "OrgUnitType" NOT NULL,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "OrgUnit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Position" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "scope" "PositionScope" NOT NULL,
    "permissionBundles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "canDelegateTo" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isUnique" BOOLEAN NOT NULL DEFAULT true,
    "isActingAllowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PositionHolder" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActing" BOOLEAN NOT NULL DEFAULT false,
    "delegatedBy" TEXT,
    "appointedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PositionHolder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrgUnit_institutionId_entityId_code_key" ON "OrgUnit"("institutionId", "entityId", "code");
CREATE INDEX IF NOT EXISTS "OrgUnit_institutionId_entityId_deletedAt_idx" ON "OrgUnit"("institutionId", "entityId", "deletedAt");
CREATE INDEX IF NOT EXISTS "OrgUnit_parentId_idx" ON "OrgUnit"("parentId");
CREATE UNIQUE INDEX IF NOT EXISTS "Position_institutionId_entityId_orgUnitId_code_key" ON "Position"("institutionId", "entityId", "orgUnitId", "code");
CREATE INDEX IF NOT EXISTS "Position_institutionId_entityId_deletedAt_idx" ON "Position"("institutionId", "entityId", "deletedAt");
CREATE INDEX IF NOT EXISTS "Position_orgUnitId_idx" ON "Position"("orgUnitId");
CREATE INDEX IF NOT EXISTS "PositionHolder_institutionId_entityId_positionId_idx" ON "PositionHolder"("institutionId", "entityId", "positionId");
CREATE INDEX IF NOT EXISTS "PositionHolder_userId_idx" ON "PositionHolder"("userId");
CREATE INDEX IF NOT EXISTS "PositionHolder_positionId_endDate_idx" ON "PositionHolder"("positionId", "endDate");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrgUnit_institutionId_fkey') THEN
    ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrgUnit_entityId_fkey') THEN
    ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrgUnit_parentId_fkey') THEN
    ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Position_institutionId_fkey') THEN
    ALTER TABLE "Position" ADD CONSTRAINT "Position_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Position_entityId_fkey') THEN
    ALTER TABLE "Position" ADD CONSTRAINT "Position_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Position_orgUnitId_fkey') THEN
    ALTER TABLE "Position" ADD CONSTRAINT "Position_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PositionHolder_institutionId_fkey') THEN
    ALTER TABLE "PositionHolder" ADD CONSTRAINT "PositionHolder_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PositionHolder_entityId_fkey') THEN
    ALTER TABLE "PositionHolder" ADD CONSTRAINT "PositionHolder_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PositionHolder_positionId_fkey') THEN
    ALTER TABLE "PositionHolder" ADD CONSTRAINT "PositionHolder_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PositionHolder_userId_fkey') THEN
    ALTER TABLE "PositionHolder" ADD CONSTRAINT "PositionHolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PositionHolder_appointedById_fkey') THEN
    ALTER TABLE "PositionHolder" ADD CONSTRAINT "PositionHolder_appointedById_fkey" FOREIGN KEY ("appointedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
