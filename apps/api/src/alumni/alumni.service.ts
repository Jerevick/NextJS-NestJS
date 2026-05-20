import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AlumniPaymentStatus, CampaignStatus, Prisma, TenantModule } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { TenantModulesService } from '../common/tenant-modules/tenant-modules.service';
import { MailService } from '../mail/mail.service';
import { readInstitutionBranding, wrapBrandedEmailHtml } from './alumni-branding.util';
import { AlumniMentorshipService } from './alumni-mentorship.service';
import { AlumniPaymentsService } from './alumni-payments.service';
import { AlumniRepository, type DirectoryFilters } from './alumni.repository';
import type { RegisterAlumniProfileDto } from './dto/register-alumni-profile.dto';
import type { UpdateAlumniProfileDto } from './dto/update-alumni-profile.dto';

@Injectable()
export class AlumniService {
  constructor(
    private readonly repo: AlumniRepository,
    private readonly mentorship: AlumniMentorshipService,
    private readonly tenantModules: TenantModulesService,
    private readonly mail: MailService,
    private readonly payments: AlumniPaymentsService,
  ) {}

  private async assertAlumniModule(institutionId: string) {
    await this.tenantModules.assertEnabled(institutionId, TenantModule.ALUMNI);
  }

  async listDirectory(user: AuthUser, filters: DirectoryFilters) {
    await this.assertAlumniModule(user.institutionId);
    const rows = await this.repo.listPublicDirectory(user.institutionId, filters);
    return rows.map((p) => {
      const prof = (p.user?.profile ?? {}) as { firstName?: string; lastName?: string };
      return {
        id: p.id,
        name: [prof.firstName, prof.lastName].filter(Boolean).join(' ') || 'Alumni',
        graduationYear: p.graduationYear,
        industry: p.industry,
        jobTitle: p.jobTitle,
        expertiseAreas: p.expertiseAreas,
        mentorshipAvailable: p.mentorshipAvailable,
        chapters: p.chapters,
        programme: p.programme,
      };
    });
  }

  async registerSelf(user: AuthUser, dto: UpdateAlumniProfileDto) {
    return this.saveSelfProfile(user, dto);
  }

  /** Alumni portal — create or update own profile without staff alumni.read permission. */
  async saveSelfProfile(user: AuthUser, dto: UpdateAlumniProfileDto) {
    await this.assertAlumniModule(user.institutionId);
    const student = await this.repo.findStudentByUserId(user.institutionId, user.userId);
    if (!student) throw new NotFoundException('No student record linked to your account');
    if (!student.graduationConfirmedAt) {
      throw new BadRequestException(
        'Alumni registration requires graduationConfirmedAt on the student record',
      );
    }
    return this.upsertFromStudent(user.institutionId, student, dto);
  }

  async registerFromStudent(user: AuthUser, dto: RegisterAlumniProfileDto) {
    await this.assertAlumniModule(user.institutionId);
    const student = await this.repo.findStudentForAlumniLink(user.institutionId, dto.studentId);
    if (!student) throw new NotFoundException('Student not found');
    if (!student.graduationConfirmedAt) {
      throw new BadRequestException(
        'Alumni registration requires graduationConfirmedAt on the student record',
      );
    }
    if (!student.userId) {
      throw new BadRequestException('Student must be linked to a user account');
    }
    return this.upsertFromStudent(user.institutionId, student, dto);
  }

  private async upsertFromStudent(
    institutionId: string,
    student: {
      id: string;
      userId: string | null;
      entityId: string;
      programId: string;
    },
    dto: RegisterAlumniProfileDto | UpdateAlumniProfileDto,
  ) {
    const profile = await this.repo.upsertProfile({
      institutionId,
      entityId: student.entityId,
      userId: student.userId!,
      studentId: student.id,
      programmeId: student.programId,
      graduationYear: dto.graduationYear,
      currentEmployer: dto.currentEmployer,
      jobTitle: dto.jobTitle,
      industry: dto.industry,
      bio: dto.bio,
      expertiseAreas: dto.expertiseAreas,
      mentorshipAvailable: dto.mentorshipAvailable ?? true,
    });
    await this.mentorship.syncMentorEmbedding(institutionId, profile.id);
    return profile;
  }

  async updateProfile(user: AuthUser, id: string, dto: UpdateAlumniProfileDto) {
    await this.assertAlumniModule(user.institutionId);
    const existing = await this.repo.findProfileById(user.institutionId, id);
    if (!existing) throw new NotFoundException('Alumni profile not found');
    if (!existing.studentId) {
      throw new BadRequestException('Alumni profile is not linked to a student record');
    }
    const student = await this.repo.findStudentForAlumniLink(
      user.institutionId,
      existing.studentId,
    );
    if (!student) throw new NotFoundException('Linked student not found');

    const profile = await this.repo.upsertProfile({
      institutionId: user.institutionId,
      entityId: existing.entityId,
      userId: existing.userId,
      studentId: existing.studentId,
      programmeId: existing.programmeId ?? student.programId,
      graduationYear: dto.graduationYear ?? existing.graduationYear ?? undefined,
      currentEmployer: dto.currentEmployer ?? existing.currentEmployer ?? undefined,
      jobTitle: dto.jobTitle ?? existing.jobTitle ?? undefined,
      industry: dto.industry ?? existing.industry ?? undefined,
      bio: dto.bio ?? existing.bio ?? undefined,
      expertiseAreas: dto.expertiseAreas ?? existing.expertiseAreas,
      mentorshipAvailable: dto.mentorshipAvailable ?? existing.mentorshipAvailable,
    });
    await this.mentorship.syncMentorEmbedding(user.institutionId, profile.id);
    return profile;
  }

  async listChapters(user: AuthUser, entityId?: string) {
    await this.assertAlumniModule(user.institutionId);
    return this.repo.listChapters(user.institutionId, entityId);
  }

  async createChapter(
    user: AuthUser,
    body: {
      name: string;
      entityId?: string;
      region?: string;
      country?: string;
      coordinatorId?: string;
      foundedYear?: number;
    },
  ) {
    await this.assertAlumniModule(user.institutionId);
    return this.repo.createChapter({
      institution: { connect: { id: user.institutionId } },
      entity: body.entityId ? { connect: { id: body.entityId } } : undefined,
      name: body.name,
      region: body.region,
      country: body.country,
      coordinator: body.coordinatorId ? { connect: { id: body.coordinatorId } } : undefined,
      foundedYear: body.foundedYear,
    });
  }

  async updateChapter(
    user: AuthUser,
    id: string,
    body: { name?: string; isActive?: boolean; coordinatorId?: string; memberCount?: number },
  ) {
    await this.assertAlumniModule(user.institutionId);
    const result = await this.repo.updateChapter(user.institutionId, id, {
      name: body.name,
      isActive: body.isActive,
      memberCount: body.memberCount,
      coordinator: body.coordinatorId ? { connect: { id: body.coordinatorId } } : undefined,
    });
    if (!result.count) throw new NotFoundException('Chapter not found');
    return { updated: true };
  }

  async listEvents(user: AuthUser, entityId?: string) {
    await this.assertAlumniModule(user.institutionId);
    return this.repo.listEvents(user.institutionId, entityId);
  }

  async createEvent(
    user: AuthUser,
    body: {
      title: string;
      description?: string;
      entityId?: string;
      chapterId?: string;
      type?: string;
      startDate: string;
      endDate?: string;
      location?: string;
      isVirtual?: boolean;
      registrationDeadline?: string;
      capacity?: number;
      fee?: number;
    },
  ) {
    await this.assertAlumniModule(user.institutionId);
    return this.repo.createEvent({
      institutionId: user.institutionId,
      entityId: body.entityId,
      chapterId: body.chapterId,
      title: body.title,
      description: body.description,
      type: (body.type as 'OTHER') ?? 'OTHER',
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      location: body.location,
      isVirtual: body.isVirtual ?? false,
      registrationDeadline: body.registrationDeadline
        ? new Date(body.registrationDeadline)
        : undefined,
      capacity: body.capacity,
      fee: body.fee ?? 0,
    });
  }

  async registerForEvent(
    user: AuthUser,
    eventId: string,
    body?: { paymentRef?: string; successUrl?: string; cancelUrl?: string },
  ) {
    await this.assertAlumniModule(user.institutionId);
    const event = await this.repo.findEvent(user.institutionId, eventId);
    if (!event) throw new NotFoundException('Event not found');
    if (event.registrationDeadline && new Date() > event.registrationDeadline) {
      throw new BadRequestException('Registration deadline has passed');
    }
    const existing = await this.repo.findEventRegistration(eventId, user.userId);
    if (existing?.paymentStatus === AlumniPaymentStatus.COMPLETED) {
      return existing;
    }

    const fee = Number(event.fee);
    const entityId = event.entityId ?? user.entityId;
    if (!entityId) throw new BadRequestException('Entity context required for paid events');

    let paymentRef = body?.paymentRef;
    let paymentUrl: string | undefined;
    let paymentStatus: AlumniPaymentStatus = AlumniPaymentStatus.WAIVED;

    if (fee > 0) {
      if (body?.paymentRef) {
        const verified = await this.payments.verifyReference(body.paymentRef);
        paymentStatus =
          verified === 'completed' ? AlumniPaymentStatus.COMPLETED : AlumniPaymentStatus.PENDING;
        paymentRef = body.paymentRef;
      } else {
        const checkout = await this.payments.createCheckout({
          institutionId: user.institutionId,
          entityId,
          amount: fee,
          currency: 'USD',
          description: `Alumni event: ${event.title}`,
          successUrl:
            body?.successUrl ??
            `${process.env.WEB_APP_URL ?? 'http://localhost:3000'}/alumni?paid=1`,
          cancelUrl:
            body?.cancelUrl ?? `${process.env.WEB_APP_URL ?? 'http://localhost:3000'}/alumni`,
          metadata: { type: 'event', eventId, userId: user.userId },
        });
        paymentRef = checkout.reference;
        paymentUrl = checkout.paymentUrl;
        paymentStatus =
          checkout.status === 'completed'
            ? AlumniPaymentStatus.COMPLETED
            : AlumniPaymentStatus.PENDING;
        if (paymentStatus === AlumniPaymentStatus.PENDING && !paymentUrl) {
          throw new BadRequestException('Payment gateway is not configured for this institution');
        }
      }
    } else {
      paymentStatus = AlumniPaymentStatus.COMPLETED;
    }

    if (existing) {
      return this.repo.updateEventRegistration(existing.id, {
        paidAmount: fee,
        paymentRef,
        paymentUrl,
        paymentStatus,
      });
    }

    return this.repo.registerForEvent({
      institutionId: user.institutionId,
      eventId,
      userId: user.userId,
      paidAmount: fee,
      paymentRef,
      paymentUrl,
      paymentStatus,
    });
  }

  async confirmEventPayment(user: AuthUser, eventId: string, reference: string) {
    await this.assertAlumniModule(user.institutionId);
    const reg = await this.repo.findEventRegistration(eventId, user.userId);
    if (!reg) throw new NotFoundException('Registration not found');
    const status = await this.payments.verifyReference(reference);
    if (status !== 'completed') {
      throw new BadRequestException('Payment not yet completed');
    }
    return this.repo.updateEventRegistration(reg.id, {
      paymentStatus: AlumniPaymentStatus.COMPLETED,
      paymentRef: reference,
    });
  }

  async listJobs(user: AuthUser) {
    await this.assertAlumniModule(user.institutionId);
    return this.repo.listJobs(user.institutionId);
  }

  async createJob(
    user: AuthUser,
    body: {
      title: string;
      company: string;
      description: string;
      requirements?: string[];
      salary?: string;
      location?: string;
      type?: string;
      deadline?: string;
      entityId?: string;
    },
  ) {
    await this.assertAlumniModule(user.institutionId);
    return this.repo.createJob({
      institutionId: user.institutionId,
      entityId: body.entityId,
      postedById: user.userId,
      title: body.title,
      company: body.company,
      description: body.description,
      requirements: body.requirements ?? [],
      salary: body.salary,
      location: body.location,
      type: (body.type as 'FULL_TIME') ?? 'FULL_TIME',
      deadline: body.deadline ? new Date(body.deadline) : undefined,
    });
  }

  async applyToJob(user: AuthUser, jobId: string, studentId: string, coverNote?: string) {
    await this.assertAlumniModule(user.institutionId);
    const job = await this.repo.findJob(user.institutionId, jobId);
    if (!job?.isActive) throw new NotFoundException('Job posting not found');
    if (job.deadline && new Date() > job.deadline) {
      throw new BadRequestException('Application deadline has passed');
    }
    return this.repo.applyToJob({
      institutionId: user.institutionId,
      jobId,
      studentId,
      coverNote,
    });
  }

  async listCampaigns(user: AuthUser) {
    await this.assertAlumniModule(user.institutionId);
    return this.repo.listCampaigns(user.institutionId);
  }

  async createCampaign(
    user: AuthUser,
    body: {
      title: string;
      description?: string;
      targetAmount: number;
      currency?: string;
      startDate: string;
      endDate?: string;
      entityId?: string;
    },
  ) {
    await this.assertAlumniModule(user.institutionId);
    return this.repo.createCampaign({
      institutionId: user.institutionId,
      entityId: body.entityId,
      title: body.title,
      description: body.description,
      targetAmount: body.targetAmount,
      currency: body.currency ?? 'USD',
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      status: CampaignStatus.DRAFT,
    });
  }

  async activateCampaign(user: AuthUser, campaignId: string) {
    await this.assertAlumniModule(user.institutionId);
    const result = await this.repo.updateCampaign(user.institutionId, campaignId, {
      status: CampaignStatus.ACTIVE,
    });
    if (!result.count) throw new NotFoundException('Campaign not found');
    return { activated: true };
  }

  async donate(
    user: AuthUser,
    campaignId: string,
    body: {
      amount: number;
      anonymous?: boolean;
      message?: string;
      successUrl?: string;
      cancelUrl?: string;
      paymentRef?: string;
    },
  ) {
    await this.assertAlumniModule(user.institutionId);
    const campaign = await this.repo.findCampaign(user.institutionId, campaignId);
    if (!campaign || campaign.status !== CampaignStatus.ACTIVE) {
      throw new BadRequestException('Campaign is not accepting donations');
    }

    const entityId = campaign.entityId ?? user.entityId;
    if (!entityId) throw new BadRequestException('Entity context required');

    let paymentRef = body.paymentRef;
    let paymentUrl: string | undefined;

    if (!paymentRef) {
      const checkout = await this.payments.createCheckout({
        institutionId: user.institutionId,
        entityId,
        amount: body.amount,
        currency: campaign.currency,
        description: `Donation: ${campaign.title}`,
        successUrl:
          body.successUrl ??
          `${process.env.WEB_APP_URL ?? 'http://localhost:3000'}/alumni?donated=1`,
        cancelUrl: body.cancelUrl ?? `${process.env.WEB_APP_URL ?? 'http://localhost:3000'}/alumni`,
        metadata: { type: 'donation', campaignId },
      });
      paymentRef = checkout.reference;
      paymentUrl = checkout.paymentUrl;
      if (checkout.status !== 'completed' && !paymentUrl) {
        throw new BadRequestException('Payment gateway is not configured');
      }
      if (checkout.status === 'completed') {
        return this.repo.recordDonation({
          campaignId,
          donorId: body.anonymous ? undefined : user.userId,
          amount: body.amount,
          anonymous: body.anonymous ?? false,
          message: body.message,
        });
      }
      return { paymentRef, paymentUrl, status: 'pending' };
    }

    const verified = await this.payments.verifyReference(paymentRef);
    if (verified !== 'completed') {
      throw new BadRequestException('Payment not yet completed');
    }
    const donation = await this.repo.recordDonation({
      campaignId,
      donorId: body.anonymous ? undefined : user.userId,
      amount: body.amount,
      anonymous: body.anonymous ?? false,
      message: body.message,
    });
    return { donation, paymentRef };
  }

  async sendNewsletter(
    user: AuthUser,
    body: {
      subject: string;
      htmlBody: string;
      graduationYear?: number;
      programmeId?: string;
      chapter?: string;
    },
  ) {
    await this.assertAlumniModule(user.institutionId);
    const inst = await this.repo.getInstitutionWithEntity(
      user.institutionId,
      user.entityId ?? undefined,
    );
    const entitySettings = inst?.institutionEntities?.[0]?.settings;
    const branding = readInstitutionBranding(
      inst?.name ?? 'Institution',
      inst?.settings,
      entitySettings,
    );
    const html = wrapBrandedEmailHtml(branding, body.htmlBody);

    const recipients = await this.repo.listProfilesForNewsletter(user.institutionId, {
      graduationYear: body.graduationYear,
      programmeId: body.programmeId,
      chapter: body.chapter,
    });
    const emails = recipients.map((r) => r.user?.email).filter((e): e is string => Boolean(e));
    let sent = 0;
    for (const email of emails) {
      await this.mail.sendEmail(email, body.subject, body.htmlBody.replace(/<[^>]+>/g, ''), html);
      sent++;
    }
    return { recipientCount: emails.length, sent, branded: true };
  }

  async listChapterMembers(user: AuthUser, chapterId: string) {
    await this.assertAlumniModule(user.institutionId);
    const chapter = await this.repo.findChapter(user.institutionId, chapterId);
    if (!chapter) throw new NotFoundException('Chapter not found');
    return this.repo.listChapterMembers(user.institutionId, chapter.name);
  }

  async addChapterMember(user: AuthUser, chapterId: string, profileId: string) {
    await this.assertAlumniModule(user.institutionId);
    const chapter = await this.repo.findChapter(user.institutionId, chapterId);
    if (!chapter) throw new NotFoundException('Chapter not found');
    if (chapter.coordinatorId && chapter.coordinatorId !== user.userId) {
      const canManage =
        user.permissions?.includes('alumni.write') || user.permissions?.includes('*');
      if (!canManage) {
        throw new ForbiddenException(
          'Only the chapter coordinator or alumni admin can add members',
        );
      }
    }
    const profile = await this.repo.addChapterMember(user.institutionId, chapter.name, profileId);
    if (!profile) throw new NotFoundException('Alumni profile not found');
    const members = await this.repo.listChapterMembers(user.institutionId, chapter.name);
    await this.repo.updateChapter(user.institutionId, chapterId, { memberCount: members.length });
    return profile;
  }

  async removeChapterMember(user: AuthUser, chapterId: string, profileId: string) {
    await this.assertAlumniModule(user.institutionId);
    const chapter = await this.repo.findChapter(user.institutionId, chapterId);
    if (!chapter) throw new NotFoundException('Chapter not found');
    const profile = await this.repo.removeChapterMember(
      user.institutionId,
      chapter.name,
      profileId,
    );
    if (!profile) throw new NotFoundException('Alumni profile not found');
    const members = await this.repo.listChapterMembers(user.institutionId, chapter.name);
    await this.repo.updateChapter(user.institutionId, chapterId, { memberCount: members.length });
    return profile;
  }

  async openSurvey(user: AuthUser, surveyId: string, open: boolean) {
    await this.assertAlumniModule(user.institutionId);
    const result = await this.repo.updateSurvey(user.institutionId, surveyId, { isOpen: open });
    if (!result.count) throw new NotFoundException('Survey not found');
    return { isOpen: open };
  }

  async listSurveys(user: AuthUser) {
    await this.assertAlumniModule(user.institutionId);
    return this.repo.listSurveys(user.institutionId);
  }

  async createSurvey(
    user: AuthUser,
    body: {
      title: string;
      description?: string;
      questions?: unknown[];
      entityId?: string;
      opensAt?: string;
      closesAt?: string;
    },
  ) {
    await this.assertAlumniModule(user.institutionId);
    return this.repo.createSurvey({
      institutionId: user.institutionId,
      entityId: body.entityId,
      title: body.title,
      description: body.description,
      questions: (body.questions ?? []) as Prisma.InputJsonValue,
      opensAt: body.opensAt ? new Date(body.opensAt) : undefined,
      closesAt: body.closesAt ? new Date(body.closesAt) : undefined,
    });
  }

  async submitSurveyResponse(user: AuthUser, surveyId: string, answers: Record<string, unknown>) {
    await this.assertAlumniModule(user.institutionId);
    const survey = await this.repo.findSurvey(user.institutionId, surveyId);
    if (!survey?.isOpen) throw new BadRequestException('Survey is not open');
    return this.repo.submitSurveyResponse({
      surveyId,
      userId: user.userId,
      answers: answers as Prisma.InputJsonValue,
    });
  }

  async surveyAnalytics(user: AuthUser, surveyId: string) {
    await this.assertAlumniModule(user.institutionId);
    const survey = await this.repo.findSurvey(user.institutionId, surveyId);
    if (!survey) throw new NotFoundException('Survey not found');
    const responses = await this.repo.surveyAnalytics(surveyId);
    const questions = Array.isArray(survey.questions) ? survey.questions : [];
    const aggregates: Record<string, Record<string, number>> = {};
    for (const r of responses) {
      const ans = r.answers as Record<string, unknown>;
      for (const [key, val] of Object.entries(ans)) {
        aggregates[key] ??= {};
        const bucket = String(val ?? '—');
        aggregates[key][bucket] = (aggregates[key][bucket] ?? 0) + 1;
      }
    }
    return {
      surveyId,
      title: survey.title,
      questionCount: questions.length,
      responseCount: responses.length,
      aggregates,
      responses,
    };
  }
}
