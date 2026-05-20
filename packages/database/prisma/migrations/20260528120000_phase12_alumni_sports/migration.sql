-- Phase 12: Alumni extensions & Sports module

CREATE TYPE "AlumniEventType" AS ENUM ('REUNION', 'NETWORKING', 'FUNDRAISER', 'WORKSHOP', 'OTHER');
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "JobType" AS ENUM ('FULL_TIME', 'PART_TIME', 'INTERNSHIP', 'CONTRACT', 'VOLUNTEER');
CREATE TYPE "JobApplicationStatus" AS ENUM ('SUBMITTED', 'REVIEWED', 'SHORTLISTED', 'REJECTED', 'WITHDRAWN');
CREATE TYPE "SportCategory" AS ENUM ('TEAM', 'INDIVIDUAL');
CREATE TYPE "SportSeason" AS ENUM ('FALL', 'WINTER', 'SPRING', 'SUMMER', 'YEAR_ROUND');
CREATE TYPE "TeamGender" AS ENUM ('MENS', 'WOMENS', 'COED');
CREATE TYPE "TeamLevel" AS ENUM ('VARSITY', 'JV', 'CLUB', 'RECREATIONAL');
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');
CREATE TYPE "CompetitionType" AS ENUM ('LEAGUE', 'TOURNAMENT', 'FRIENDLY', 'CHAMPIONSHIP');
CREATE TYPE "CompetitionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "FixtureStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'POSTPONED', 'CANCELLED');

CREATE TABLE "AlumniChapter" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "country" TEXT,
    "coordinatorId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "foundedYear" INTEGER,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AlumniChapter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AlumniEvent" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT,
    "chapterId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "AlumniEventType" NOT NULL DEFAULT 'OTHER',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "location" TEXT,
    "isVirtual" BOOLEAN NOT NULL DEFAULT false,
    "registrationDeadline" TIMESTAMP(3),
    "capacity" INTEGER,
    "fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "AlumniEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AlumniEventRegistration" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentRef" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlumniEventRegistration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FundraisingCampaign" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetAmount" DECIMAL(14,2) NOT NULL,
    "raisedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FundraisingCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AlumniDonation" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "donorId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlumniDonation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobPosting" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT,
    "postedById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "salary" TEXT,
    "location" TEXT,
    "type" "JobType" NOT NULL DEFAULT 'FULL_TIME',
    "deadline" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "coverNote" TEXT,
    "status" "JobApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AlumniSurvey" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AlumniSurvey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AlumniSurveyResponse" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlumniSurveyResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SportType" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "SportCategory" NOT NULL DEFAULT 'TEAM',
    "season" "SportSeason" NOT NULL DEFAULT 'YEAR_ROUND',
    "rulesDocKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SportType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SportsTeam" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "sportTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" "TeamGender" NOT NULL DEFAULT 'COED',
    "level" "TeamLevel" NOT NULL DEFAULT 'VARSITY',
    "coachId" TEXT,
    "academicYearId" TEXT,
    "homeVenue" TEXT,
    "colors" JSONB,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "SportsTeam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SportsPlayer" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "position" TEXT,
    "jerseyNumber" TEXT,
    "joinedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isEligible" BOOLEAN NOT NULL DEFAULT true,
    "ineligibilityReason" TEXT,
    "medicalClearance" BOOLEAN NOT NULL DEFAULT false,
    "careerStats" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SportsPlayer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SportsFacility" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "capacity" INTEGER,
    "location" TEXT,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maintenanceSchedule" JSONB NOT NULL DEFAULT '{}',
    "bookingRules" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SportsFacility_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FacilityBooking" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "bookedById" TEXT NOT NULL,
    "teamId" TEXT,
    "purpose" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "attendeeCount" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FacilityBooking_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SportsCompetition" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT,
    "name" TEXT NOT NULL,
    "type" "CompetitionType" NOT NULL DEFAULT 'LEAGUE',
    "sportTypeId" TEXT NOT NULL,
    "organizerId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "venue" TEXT,
    "status" "CompetitionStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "SportsCompetition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SportsFixture" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT,
    "competitionId" TEXT,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "venue" TEXT,
    "status" "FixtureStatus" NOT NULL DEFAULT 'SCHEDULED',
    "score" JSONB,
    "statistics" JSONB,
    "matchReport" TEXT,
    "streamUrl" TEXT,
    "logistics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SportsFixture_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AlumniEventRegistration_eventId_userId_key" ON "AlumniEventRegistration"("eventId", "userId");
CREATE INDEX "AlumniChapter_institutionId_isActive_idx" ON "AlumniChapter"("institutionId", "isActive");
CREATE INDEX "AlumniEvent_institutionId_startDate_idx" ON "AlumniEvent"("institutionId", "startDate");
CREATE INDEX "AlumniEventRegistration_institutionId_eventId_idx" ON "AlumniEventRegistration"("institutionId", "eventId");
CREATE INDEX "FundraisingCampaign_institutionId_status_idx" ON "FundraisingCampaign"("institutionId", "status");
CREATE INDEX "AlumniDonation_campaignId_idx" ON "AlumniDonation"("campaignId");
CREATE INDEX "JobPosting_institutionId_isActive_idx" ON "JobPosting"("institutionId", "isActive");
CREATE UNIQUE INDEX "JobApplication_jobId_studentId_key" ON "JobApplication"("jobId", "studentId");
CREATE INDEX "JobApplication_institutionId_jobId_idx" ON "JobApplication"("institutionId", "jobId");
CREATE INDEX "AlumniSurvey_institutionId_isOpen_idx" ON "AlumniSurvey"("institutionId", "isOpen");
CREATE UNIQUE INDEX "AlumniSurveyResponse_surveyId_userId_key" ON "AlumniSurveyResponse"("surveyId", "userId");
CREATE INDEX "SportType_institutionId_entityId_idx" ON "SportType"("institutionId", "entityId");
CREATE INDEX "SportsTeam_institutionId_entityId_sportTypeId_idx" ON "SportsTeam"("institutionId", "entityId", "sportTypeId");
CREATE UNIQUE INDEX "SportsPlayer_teamId_studentId_key" ON "SportsPlayer"("teamId", "studentId");
CREATE INDEX "SportsPlayer_institutionId_teamId_isEligible_idx" ON "SportsPlayer"("institutionId", "teamId", "isEligible");
CREATE INDEX "SportsFacility_institutionId_entityId_idx" ON "SportsFacility"("institutionId", "entityId");
CREATE INDEX "FacilityBooking_institutionId_facilityId_startTime_idx" ON "FacilityBooking"("institutionId", "facilityId", "startTime");
CREATE INDEX "SportsCompetition_institutionId_status_idx" ON "SportsCompetition"("institutionId", "status");
CREATE INDEX "SportsFixture_institutionId_scheduledAt_idx" ON "SportsFixture"("institutionId", "scheduledAt");
CREATE INDEX "SportsFixture_competitionId_idx" ON "SportsFixture"("competitionId");

ALTER TABLE "AlumniChapter" ADD CONSTRAINT "AlumniChapter_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlumniChapter" ADD CONSTRAINT "AlumniChapter_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AlumniChapter" ADD CONSTRAINT "AlumniChapter_coordinatorId_fkey" FOREIGN KEY ("coordinatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AlumniEvent" ADD CONSTRAINT "AlumniEvent_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlumniEvent" ADD CONSTRAINT "AlumniEvent_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AlumniEvent" ADD CONSTRAINT "AlumniEvent_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "AlumniChapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AlumniEventRegistration" ADD CONSTRAINT "AlumniEventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "AlumniEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FundraisingCampaign" ADD CONSTRAINT "FundraisingCampaign_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FundraisingCampaign" ADD CONSTRAINT "FundraisingCampaign_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AlumniDonation" ADD CONSTRAINT "AlumniDonation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "FundraisingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AlumniSurvey" ADD CONSTRAINT "AlumniSurvey_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlumniSurvey" ADD CONSTRAINT "AlumniSurvey_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AlumniSurveyResponse" ADD CONSTRAINT "AlumniSurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "AlumniSurvey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SportType" ADD CONSTRAINT "SportType_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SportType" ADD CONSTRAINT "SportType_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SportsTeam" ADD CONSTRAINT "SportsTeam_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SportsTeam" ADD CONSTRAINT "SportsTeam_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SportsTeam" ADD CONSTRAINT "SportsTeam_sportTypeId_fkey" FOREIGN KEY ("sportTypeId") REFERENCES "SportType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SportsTeam" ADD CONSTRAINT "SportsTeam_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SportsTeam" ADD CONSTRAINT "SportsTeam_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SportsPlayer" ADD CONSTRAINT "SportsPlayer_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SportsPlayer" ADD CONSTRAINT "SportsPlayer_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SportsPlayer" ADD CONSTRAINT "SportsPlayer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "SportsTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SportsPlayer" ADD CONSTRAINT "SportsPlayer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SportsFacility" ADD CONSTRAINT "SportsFacility_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SportsFacility" ADD CONSTRAINT "SportsFacility_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FacilityBooking" ADD CONSTRAINT "FacilityBooking_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacilityBooking" ADD CONSTRAINT "FacilityBooking_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacilityBooking" ADD CONSTRAINT "FacilityBooking_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "SportsFacility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FacilityBooking" ADD CONSTRAINT "FacilityBooking_bookedById_fkey" FOREIGN KEY ("bookedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SportsCompetition" ADD CONSTRAINT "SportsCompetition_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SportsCompetition" ADD CONSTRAINT "SportsCompetition_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SportsCompetition" ADD CONSTRAINT "SportsCompetition_sportTypeId_fkey" FOREIGN KEY ("sportTypeId") REFERENCES "SportType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SportsCompetition" ADD CONSTRAINT "SportsCompetition_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SportsFixture" ADD CONSTRAINT "SportsFixture_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SportsFixture" ADD CONSTRAINT "SportsFixture_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SportsFixture" ADD CONSTRAINT "SportsFixture_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "SportsCompetition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SportsFixture" ADD CONSTRAINT "SportsFixture_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "SportsTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SportsFixture" ADD CONSTRAINT "SportsFixture_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "SportsTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
