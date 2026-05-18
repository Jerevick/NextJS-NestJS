-- Phase 12: Alumni profiles & AI mentorship matching

ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "careerGoals" TEXT;

CREATE TYPE "MentorshipStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

CREATE TABLE "AlumniProfile" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studentId" TEXT,
    "programmeId" TEXT,
    "graduationYear" INTEGER,
    "currentEmployer" TEXT,
    "jobTitle" TEXT,
    "industry" TEXT,
    "linkedinUrl" TEXT,
    "bio" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "chapters" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mentorshipAvailable" BOOLEAN NOT NULL DEFAULT true,
    "expertiseAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "geoLocation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AlumniProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AlumniProfile_userId_key" ON "AlumniProfile"("userId");
CREATE UNIQUE INDEX "AlumniProfile_studentId_key" ON "AlumniProfile"("studentId");
CREATE INDEX "AlumniProfile_institutionId_entityId_idx" ON "AlumniProfile"("institutionId", "entityId");
CREATE INDEX "AlumniProfile_institutionId_mentorshipAvailable_idx" ON "AlumniProfile"("institutionId", "mentorshipAvailable");

CREATE TABLE "MentorshipProgram" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorshipProgram_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MentorshipProgram_institutionId_entityId_isActive_idx" ON "MentorshipProgram"("institutionId", "entityId", "isActive");

CREATE TABLE "MentorshipPair" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "mentorUserId" TEXT NOT NULL,
    "menteeStudentId" TEXT NOT NULL,
    "status" "MentorshipStatus" NOT NULL DEFAULT 'PENDING',
    "goals" JSONB NOT NULL DEFAULT '{}',
    "sessionCount" INTEGER NOT NULL DEFAULT 0,
    "nextSessionDate" TIMESTAMP(3),
    "rating" DECIMAL(65,30),
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorshipPair_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MentorshipPair_programId_mentorUserId_menteeStudentId_key" ON "MentorshipPair"("programId", "mentorUserId", "menteeStudentId");
CREATE INDEX "MentorshipPair_institutionId_status_idx" ON "MentorshipPair"("institutionId", "status");

ALTER TABLE "AlumniProfile" ADD CONSTRAINT "AlumniProfile_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlumniProfile" ADD CONSTRAINT "AlumniProfile_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AlumniProfile" ADD CONSTRAINT "AlumniProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlumniProfile" ADD CONSTRAINT "AlumniProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AlumniProfile" ADD CONSTRAINT "AlumniProfile_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MentorshipProgram" ADD CONSTRAINT "MentorshipProgram_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MentorshipProgram" ADD CONSTRAINT "MentorshipProgram_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MentorshipPair" ADD CONSTRAINT "MentorshipPair_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MentorshipPair" ADD CONSTRAINT "MentorshipPair_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MentorshipPair" ADD CONSTRAINT "MentorshipPair_programId_fkey" FOREIGN KEY ("programId") REFERENCES "MentorshipProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MentorshipPair" ADD CONSTRAINT "MentorshipPair_mentorUserId_fkey" FOREIGN KEY ("mentorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MentorshipPair" ADD CONSTRAINT "MentorshipPair_menteeStudentId_fkey" FOREIGN KEY ("menteeStudentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
