-- Phase 11: Elections & meetings

CREATE TYPE "ElectionType" AS ENUM ('STUDENT_GOVERNMENT', 'FACULTY_COUNCIL', 'STAFF_REPRESENTATIVE', 'GENERAL');
CREATE TYPE "ElectionStatus" AS ENUM ('DRAFT', 'NOMINATIONS_OPEN', 'NOMINATIONS_CLOSED', 'VOTING_OPEN', 'VOTING_CLOSED', 'CERTIFICATION_PENDING', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "CandidateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');
CREATE TYPE "MeetingType" AS ENUM ('SENATE', 'ACADEMIC_BOARD', 'FACULTY_BOARD', 'DEPARTMENTAL', 'COMMITTEE', 'AD_HOC');
CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'POSTPONED');
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'TENTATIVE');
CREATE TYPE "AgendaItemType" AS ENUM ('INFORMATION', 'DISCUSSION', 'DECISION', 'RESOLUTION', 'OTHER');
CREATE TYPE "ResolutionOutcome" AS ENUM ('PASSED', 'FAILED', 'DEFERRED', 'WITHDRAWN');
CREATE TYPE "CommitteeType" AS ENUM ('STANDING', 'AD_HOC');
CREATE TYPE "MeetingActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE "Election" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" "ElectionType" NOT NULL DEFAULT 'GENERAL',
    "eligibilityOrgUnitId" TEXT,
    "eligibilityRules" JSONB NOT NULL DEFAULT '{}',
    "positions" JSONB NOT NULL DEFAULT '[]',
    "nominationOpenDate" TIMESTAMP(3) NOT NULL,
    "nominationCloseDate" TIMESTAMP(3) NOT NULL,
    "votingOpenDate" TIMESTAMP(3) NOT NULL,
    "votingCloseDate" TIMESTAMP(3) NOT NULL,
    "status" "ElectionStatus" NOT NULL DEFAULT 'DRAFT',
    "resultsPublishedAt" TIMESTAMP(3),
    "certifiedBy" TEXT,
    "certifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Election_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ElectionCandidate" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "manifesto" TEXT NOT NULL DEFAULT '',
    "manifestoDocKey" TEXT,
    "photo" TEXT,
    "nominatedBy" TEXT NOT NULL,
    "secondedBy" TEXT,
    "status" "CandidateStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectionCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ElectionVoter" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hasVoted" BOOLEAN NOT NULL DEFAULT false,
    "votedAt" TIMESTAMP(3),
    "verificationToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectionVoter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ElectionVote" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "voterHash" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "castAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verificationToken" TEXT NOT NULL,

    CONSTRAINT "ElectionVote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ElectionAuditLog" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectionAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "MeetingType" NOT NULL,
    "convenerPositionId" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "committeeId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "location" TEXT,
    "meetingLink" TEXT,
    "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "quorumRequired" INTEGER NOT NULL DEFAULT 0,
    "quorumMet" BOOLEAN,
    "agenda" JSONB NOT NULL DEFAULT '[]',
    "minutesFileKey" TEXT,
    "minutesDraftKey" TEXT,
    "minutesDraft" JSONB,
    "minutesApprovedAt" TIMESTAMP(3),
    "minutesApprovedBy" TEXT,
    "isConfidential" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingAttendee" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "positionId" TEXT,
    "inviteStatus" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "attended" BOOLEAN,
    "arrivalTime" TIMESTAMP(3),
    "departureTime" TIMESTAMP(3),
    "apology" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingAttendee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgendaItem" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "itemNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "presenterId" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 15,
    "order" INTEGER NOT NULL DEFAULT 0,
    "type" "AgendaItemType" NOT NULL DEFAULT 'DISCUSSION',
    "papers" JSONB NOT NULL DEFAULT '[]',
    "discussion" TEXT,
    "decision" TEXT,
    "actionItems" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgendaItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Resolution" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "agendaItemId" TEXT,
    "resolutionNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "movedBy" TEXT NOT NULL,
    "secondedBy" TEXT NOT NULL,
    "votesFor" INTEGER NOT NULL DEFAULT 0,
    "votesAgainst" INTEGER NOT NULL DEFAULT 0,
    "abstentions" INTEGER NOT NULL DEFAULT 0,
    "outcome" "ResolutionOutcome" NOT NULL DEFAULT 'PASSED',
    "implementedAt" TIMESTAMP(3),
    "implementedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resolution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingCommittee" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT,
    "orgUnitId" TEXT,
    "name" TEXT NOT NULL,
    "type" "CommitteeType" NOT NULL DEFAULT 'STANDING',
    "termStart" TIMESTAMP(3),
    "termEnd" TIMESTAMP(3),
    "memberUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingCommittee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MeetingActionItem" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "assignedToId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "MeetingActionStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingActionItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ElectionCandidate_electionId_userId_position_key" ON "ElectionCandidate"("electionId", "userId", "position");
CREATE INDEX "ElectionCandidate_electionId_status_idx" ON "ElectionCandidate"("electionId", "status");

CREATE UNIQUE INDEX "ElectionVoter_electionId_userId_key" ON "ElectionVoter"("electionId", "userId");
CREATE UNIQUE INDEX "ElectionVoter_verificationToken_key" ON "ElectionVoter"("verificationToken");
CREATE INDEX "ElectionVoter_electionId_idx" ON "ElectionVoter"("electionId");

CREATE UNIQUE INDEX "ElectionVote_verificationToken_key" ON "ElectionVote"("verificationToken");
CREATE UNIQUE INDEX "ElectionVote_electionId_voterHash_position_key" ON "ElectionVote"("electionId", "voterHash", "position");
CREATE INDEX "ElectionVote_electionId_position_idx" ON "ElectionVote"("electionId", "position");

CREATE INDEX "Election_institutionId_entityId_status_idx" ON "Election"("institutionId", "entityId", "status");
CREATE INDEX "Election_institutionId_deletedAt_idx" ON "Election"("institutionId", "deletedAt");

CREATE INDEX "ElectionAuditLog_electionId_createdAt_idx" ON "ElectionAuditLog"("electionId", "createdAt");

CREATE UNIQUE INDEX "MeetingAttendee_meetingId_userId_key" ON "MeetingAttendee"("meetingId", "userId");
CREATE INDEX "MeetingAttendee_meetingId_idx" ON "MeetingAttendee"("meetingId");

CREATE INDEX "AgendaItem_meetingId_order_idx" ON "AgendaItem"("meetingId", "order");

CREATE UNIQUE INDEX "Resolution_institutionId_resolutionNumber_key" ON "Resolution"("institutionId", "resolutionNumber");
CREATE INDEX "Resolution_institutionId_entityId_idx" ON "Resolution"("institutionId", "entityId");
CREATE INDEX "Resolution_meetingId_idx" ON "Resolution"("meetingId");

CREATE INDEX "Meeting_institutionId_entityId_status_idx" ON "Meeting"("institutionId", "entityId", "status");
CREATE INDEX "Meeting_scheduledAt_idx" ON "Meeting"("scheduledAt");

CREATE INDEX "MeetingCommittee_institutionId_isActive_idx" ON "MeetingCommittee"("institutionId", "isActive");

CREATE INDEX "MeetingActionItem_meetingId_status_idx" ON "MeetingActionItem"("meetingId", "status");
CREATE INDEX "MeetingActionItem_assignedToId_status_idx" ON "MeetingActionItem"("assignedToId", "status");

ALTER TABLE "Election" ADD CONSTRAINT "Election_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Election" ADD CONSTRAINT "Election_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Election" ADD CONSTRAINT "Election_eligibilityOrgUnitId_fkey" FOREIGN KEY ("eligibilityOrgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ElectionCandidate" ADD CONSTRAINT "ElectionCandidate_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectionCandidate" ADD CONSTRAINT "ElectionCandidate_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectionCandidate" ADD CONSTRAINT "ElectionCandidate_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectionCandidate" ADD CONSTRAINT "ElectionCandidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ElectionVoter" ADD CONSTRAINT "ElectionVoter_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectionVoter" ADD CONSTRAINT "ElectionVoter_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectionVoter" ADD CONSTRAINT "ElectionVoter_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectionVoter" ADD CONSTRAINT "ElectionVoter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ElectionVote" ADD CONSTRAINT "ElectionVote_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectionVote" ADD CONSTRAINT "ElectionVote_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectionVote" ADD CONSTRAINT "ElectionVote_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectionVote" ADD CONSTRAINT "ElectionVote_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "ElectionCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ElectionAuditLog" ADD CONSTRAINT "ElectionAuditLog_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectionAuditLog" ADD CONSTRAINT "ElectionAuditLog_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ElectionAuditLog" ADD CONSTRAINT "ElectionAuditLog_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_convenerPositionId_fkey" FOREIGN KEY ("convenerPositionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "MeetingCommittee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AgendaItem" ADD CONSTRAINT "AgendaItem_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgendaItem" ADD CONSTRAINT "AgendaItem_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgendaItem" ADD CONSTRAINT "AgendaItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Resolution" ADD CONSTRAINT "Resolution_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Resolution" ADD CONSTRAINT "Resolution_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Resolution" ADD CONSTRAINT "Resolution_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Resolution" ADD CONSTRAINT "Resolution_agendaItemId_fkey" FOREIGN KEY ("agendaItemId") REFERENCES "AgendaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MeetingCommittee" ADD CONSTRAINT "MeetingCommittee_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingCommittee" ADD CONSTRAINT "MeetingCommittee_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingCommittee" ADD CONSTRAINT "MeetingCommittee_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MeetingActionItem" ADD CONSTRAINT "MeetingActionItem_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingActionItem" ADD CONSTRAINT "MeetingActionItem_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "InstitutionEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingActionItem" ADD CONSTRAINT "MeetingActionItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MeetingActionItem" ADD CONSTRAINT "MeetingActionItem_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
