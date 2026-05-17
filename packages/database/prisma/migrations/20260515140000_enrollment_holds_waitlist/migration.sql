-- CreateEnum
CREATE TYPE "EnrollmentHoldType" AS ENUM ('FINANCIAL', 'ACADEMIC', 'ADMINISTRATIVE', 'LIBRARY', 'DISCIPLINARY');

-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('WAITING', 'PROMOTED', 'REMOVED');

-- CreateTable
CREATE TABLE "EnrollmentHold" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "type" "EnrollmentHoldType" NOT NULL,
    "reason" TEXT NOT NULL,
    "placedById" TEXT NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftedAt" TIMESTAMP(3),
    "liftedById" TEXT,
    "liftNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "EnrollmentHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionWaitlistEntry" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promotedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SectionWaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnrollmentHold_institutionId_studentId_liftedAt_idx" ON "EnrollmentHold"("institutionId", "studentId", "liftedAt");

-- CreateIndex
CREATE INDEX "EnrollmentHold_institutionId_entityId_idx" ON "EnrollmentHold"("institutionId", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "SectionWaitlistEntry_studentId_sectionId_key" ON "SectionWaitlistEntry"("studentId", "sectionId");

-- CreateIndex
CREATE INDEX "SectionWaitlistEntry_sectionId_status_position_idx" ON "SectionWaitlistEntry"("sectionId", "status", "position");

-- CreateIndex
CREATE INDEX "SectionWaitlistEntry_institutionId_idx" ON "SectionWaitlistEntry"("institutionId");

-- AddForeignKey
ALTER TABLE "EnrollmentHold" ADD CONSTRAINT "EnrollmentHold_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentHold" ADD CONSTRAINT "EnrollmentHold_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentHold" ADD CONSTRAINT "EnrollmentHold_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentHold" ADD CONSTRAINT "EnrollmentHold_placedById_fkey" FOREIGN KEY ("placedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrollmentHold" ADD CONSTRAINT "EnrollmentHold_liftedById_fkey" FOREIGN KEY ("liftedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionWaitlistEntry" ADD CONSTRAINT "SectionWaitlistEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionWaitlistEntry" ADD CONSTRAINT "SectionWaitlistEntry_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionWaitlistEntry" ADD CONSTRAINT "SectionWaitlistEntry_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SectionWaitlistEntry" ADD CONSTRAINT "SectionWaitlistEntry_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
