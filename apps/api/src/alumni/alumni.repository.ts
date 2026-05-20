import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type DirectoryFilters = {
  entityId?: string;
  q?: string;
  industry?: string;
  programmeId?: string;
  graduationYear?: number;
  chapter?: string;
  location?: string;
};

@Injectable()
export class AlumniRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProfileById(institutionId: string, id: string) {
    return this.prisma.alumniProfile.findFirst({
      where: { id, institutionId, deletedAt: null },
      include: { user: { select: { profile: true } } },
    });
  }

  findProfileByUserId(institutionId: string, userId: string) {
    return this.prisma.alumniProfile.findFirst({
      where: { userId, institutionId, deletedAt: null },
    });
  }

  findProfileDetailByUserId(institutionId: string, userId: string) {
    return this.prisma.alumniProfile.findFirst({
      where: { userId, institutionId, deletedAt: null },
      include: {
        programme: { select: { code: true, name: true } },
        entity: { select: { code: true, name: true } },
      },
    });
  }

  findUserBrief(userId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId },
      select: { email: true, profile: true },
    });
  }

  findProfilesByIds(institutionId: string, ids: string[]) {
    if (!ids.length) return Promise.resolve([]);
    return this.prisma.alumniProfile.findMany({
      where: { institutionId, id: { in: ids }, deletedAt: null },
      include: { user: { select: { profile: true } } },
    });
  }

  findStudentForMentorship(institutionId: string, studentId: string) {
    return this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
      include: {
        program: { select: { id: true, name: true, code: true, departmentId: true } },
        user: { select: { profile: true } },
      },
    });
  }

  findStudentForAlumniLink(institutionId: string, studentId: string) {
    return this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
      select: {
        id: true,
        userId: true,
        entityId: true,
        programId: true,
        graduationConfirmedAt: true,
      },
    });
  }

  findStudentByUserId(institutionId: string, userId: string) {
    return this.prisma.student.findFirst({
      where: { userId, institutionId, deletedAt: null },
      select: {
        id: true,
        userId: true,
        entityId: true,
        programId: true,
        graduationConfirmedAt: true,
      },
    });
  }

  upsertProfile(data: {
    institutionId: string;
    entityId: string;
    userId: string;
    studentId: string;
    programmeId: string;
    graduationYear?: number;
    currentEmployer?: string;
    jobTitle?: string;
    industry?: string;
    bio?: string;
    expertiseAreas?: string[];
    mentorshipAvailable?: boolean;
    chapters?: string[];
    linkedinUrl?: string;
    isPublic?: boolean;
  }) {
    return this.prisma.alumniProfile.upsert({
      where: { userId: data.userId },
      create: data,
      update: {
        entityId: data.entityId,
        studentId: data.studentId,
        programmeId: data.programmeId,
        graduationYear: data.graduationYear,
        currentEmployer: data.currentEmployer,
        jobTitle: data.jobTitle,
        industry: data.industry,
        bio: data.bio,
        expertiseAreas: data.expertiseAreas ?? [],
        mentorshipAvailable: data.mentorshipAvailable ?? true,
        chapters: data.chapters,
        linkedinUrl: data.linkedinUrl,
        isPublic: data.isPublic,
        deletedAt: null,
      },
    });
  }

  async listPublicDirectory(institutionId: string, filters: DirectoryFilters) {
    const q = filters.q?.trim().toLowerCase();
    const rows = await this.prisma.alumniProfile.findMany({
      where: {
        institutionId,
        deletedAt: null,
        isPublic: true,
        ...(filters.entityId ? { entityId: filters.entityId } : {}),
        ...(filters.industry
          ? { industry: { contains: filters.industry, mode: 'insensitive' as const } }
          : {}),
        ...(filters.programmeId ? { programmeId: filters.programmeId } : {}),
        ...(filters.graduationYear ? { graduationYear: filters.graduationYear } : {}),
        ...(filters.chapter ? { chapters: { has: filters.chapter } } : {}),
      },
      orderBy: { graduationYear: 'desc' },
      take: 200,
      include: {
        user: { select: { profile: true } },
        programme: { select: { id: true, name: true, code: true } },
      },
    });

    const loc = filters.location?.trim().toLowerCase();
    let filtered = rows;
    if (loc) {
      filtered = filtered.filter((p) => {
        const geo = p.geoLocation;
        if (!geo || typeof geo !== 'object' || Array.isArray(geo)) return false;
        const g = geo as Record<string, unknown>;
        const hay = [g.city, g.region, g.country, g.label]
          .filter((v) => typeof v === 'string')
          .join(' ')
          .toLowerCase();
        return hay.includes(loc);
      });
    }

    if (!q) return filtered;

    return filtered.filter((p) => {
      const prof = (p.user?.profile ?? {}) as { firstName?: string; lastName?: string };
      const name = [prof.firstName, prof.lastName].filter(Boolean).join(' ').toLowerCase();
      const hay = [
        name,
        p.industry?.toLowerCase() ?? '',
        p.jobTitle?.toLowerCase() ?? '',
        p.currentEmployer?.toLowerCase() ?? '',
        p.programme?.name.toLowerCase() ?? '',
        p.programme?.code.toLowerCase() ?? '',
        String(p.graduationYear ?? ''),
      ].join(' ');
      return hay.includes(q);
    });
  }

  findChapter(institutionId: string, id: string) {
    return this.prisma.alumniChapter.findFirst({ where: { id, institutionId } });
  }

  listChapters(institutionId: string, entityId?: string) {
    return this.prisma.alumniChapter.findMany({
      where: {
        institutionId,
        isActive: true,
        ...(entityId ? { entityId } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  listChapterMembers(institutionId: string, chapterName: string) {
    return this.prisma.alumniProfile.findMany({
      where: {
        institutionId,
        deletedAt: null,
        chapters: { has: chapterName },
      },
      include: { user: { select: { profile: true, email: true } } },
    });
  }

  async addChapterMember(institutionId: string, chapterName: string, profileId: string) {
    const profile = await this.prisma.alumniProfile.findFirst({
      where: { id: profileId, institutionId, deletedAt: null },
    });
    if (!profile) return null;
    const chapters = profile.chapters.includes(chapterName)
      ? profile.chapters
      : [...profile.chapters, chapterName];
    return this.prisma.alumniProfile.update({
      where: { id: profileId },
      data: { chapters },
    });
  }

  async removeChapterMember(institutionId: string, chapterName: string, profileId: string) {
    const profile = await this.prisma.alumniProfile.findFirst({
      where: { id: profileId, institutionId, deletedAt: null },
    });
    if (!profile) return null;
    return this.prisma.alumniProfile.update({
      where: { id: profileId },
      data: { chapters: profile.chapters.filter((c) => c !== chapterName) },
    });
  }

  createChapter(data: Prisma.AlumniChapterCreateInput) {
    return this.prisma.alumniChapter.create({ data });
  }

  updateChapter(institutionId: string, id: string, data: Prisma.AlumniChapterUpdateInput) {
    return this.prisma.alumniChapter.updateMany({
      where: { id, institutionId },
      data,
    });
  }

  listEvents(institutionId: string, entityId?: string) {
    return this.prisma.alumniEvent.findMany({
      where: {
        institutionId,
        deletedAt: null,
        ...(entityId ? { entityId } : {}),
      },
      orderBy: { startDate: 'asc' },
      include: { _count: { select: { registrations: true } } },
    });
  }

  /** Institution-wide events plus events for the alumni's campus. */
  listEventsForCampus(institutionId: string, entityId?: string) {
    return this.prisma.alumniEvent.findMany({
      where: {
        institutionId,
        deletedAt: null,
        OR: entityId ? [{ entityId: null }, { entityId }] : [{ entityId: null }],
      },
      orderBy: { startDate: 'asc' },
      include: { _count: { select: { registrations: true } } },
    });
  }

  listUserEventRegistrations(userId: string, eventIds: string[]) {
    if (!eventIds.length) {
      return Promise.resolve([]);
    }
    return this.prisma.alumniEventRegistration.findMany({
      where: { userId, eventId: { in: eventIds } },
      select: {
        eventId: true,
        paymentStatus: true,
        paymentUrl: true,
      },
    });
  }

  findEvent(institutionId: string, id: string) {
    return this.prisma.alumniEvent.findFirst({
      where: { id, institutionId, deletedAt: null },
    });
  }

  createEvent(data: Prisma.AlumniEventUncheckedCreateInput) {
    return this.prisma.alumniEvent.create({ data });
  }

  findEventRegistration(eventId: string, userId: string) {
    return this.prisma.alumniEventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
  }

  registerForEvent(data: Prisma.AlumniEventRegistrationUncheckedCreateInput) {
    return this.prisma.alumniEventRegistration.create({ data });
  }

  updateEventRegistration(id: string, data: Prisma.AlumniEventRegistrationUpdateInput) {
    return this.prisma.alumniEventRegistration.update({ where: { id }, data });
  }

  getInstitutionWithEntity(institutionId: string, entityId?: string) {
    return this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: {
        name: true,
        settings: true,
        institutionEntities: entityId
          ? { where: { id: entityId }, select: { settings: true }, take: 1 }
          : undefined,
      },
    });
  }

  listJobs(institutionId: string, activeOnly = true) {
    return this.prisma.jobPosting.findMany({
      where: {
        institutionId,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  createJob(data: Prisma.JobPostingUncheckedCreateInput) {
    return this.prisma.jobPosting.create({ data });
  }

  findJob(institutionId: string, id: string) {
    return this.prisma.jobPosting.findFirst({ where: { id, institutionId } });
  }

  applyToJob(data: Prisma.JobApplicationUncheckedCreateInput) {
    return this.prisma.jobApplication.create({ data });
  }

  listCampaigns(institutionId: string) {
    return this.prisma.fundraisingCampaign.findMany({
      where: { institutionId },
      orderBy: { startDate: 'desc' },
    });
  }

  createCampaign(data: Prisma.FundraisingCampaignUncheckedCreateInput) {
    return this.prisma.fundraisingCampaign.create({ data });
  }

  findCampaign(institutionId: string, id: string) {
    return this.prisma.fundraisingCampaign.findFirst({ where: { id, institutionId } });
  }

  recordDonation(data: Prisma.AlumniDonationUncheckedCreateInput) {
    return this.prisma.$transaction(async (tx) => {
      const donation = await tx.alumniDonation.create({ data });
      await tx.fundraisingCampaign.update({
        where: { id: data.campaignId },
        data: { raisedAmount: { increment: data.amount } },
      });
      return donation;
    });
  }

  listSurveys(institutionId: string) {
    return this.prisma.alumniSurvey.findMany({
      where: { institutionId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { responses: true } } },
    });
  }

  createSurvey(data: Prisma.AlumniSurveyUncheckedCreateInput) {
    return this.prisma.alumniSurvey.create({ data });
  }

  findSurvey(institutionId: string, id: string) {
    return this.prisma.alumniSurvey.findFirst({ where: { id, institutionId } });
  }

  submitSurveyResponse(data: Prisma.AlumniSurveyResponseUncheckedCreateInput) {
    return this.prisma.alumniSurveyResponse.upsert({
      where: { surveyId_userId: { surveyId: data.surveyId, userId: data.userId } },
      create: data,
      update: { answers: data.answers },
    });
  }

  surveyAnalytics(surveyId: string) {
    return this.prisma.alumniSurveyResponse.findMany({
      where: { surveyId },
      select: { answers: true, createdAt: true },
    });
  }

  updateSurvey(institutionId: string, id: string, data: Prisma.AlumniSurveyUpdateInput) {
    return this.prisma.alumniSurvey.updateMany({ where: { id, institutionId }, data });
  }

  updateCampaign(institutionId: string, id: string, data: Prisma.FundraisingCampaignUpdateInput) {
    return this.prisma.fundraisingCampaign.updateMany({ where: { id, institutionId }, data });
  }

  listProfilesForNewsletter(
    institutionId: string,
    filters: { graduationYear?: number; programmeId?: string; chapter?: string },
  ) {
    return this.prisma.alumniProfile.findMany({
      where: {
        institutionId,
        deletedAt: null,
        ...(filters.graduationYear ? { graduationYear: filters.graduationYear } : {}),
        ...(filters.programmeId ? { programmeId: filters.programmeId } : {}),
        ...(filters.chapter ? { chapters: { has: filters.chapter } } : {}),
      },
      include: { user: { select: { email: true, profile: true } } },
    });
  }
}
