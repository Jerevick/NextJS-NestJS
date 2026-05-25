import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  InviteStatus,
  MeetingActionStatus,
  MeetingStatus,
  Prisma,
  ResolutionOutcome,
  TenantModule,
} from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { TenantModulesService } from '../common/tenant-modules/tenant-modules.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import type { CreateMeetingDto } from './dto/create-meeting.dto';
import type { GenerateMinutesDto } from './dto/generate-minutes.dto';
import type { UpdateMeetingDto } from './dto/update-meeting.dto';
import type { UpsertAgendaItemDto } from './dto/upsert-agenda-item.dto';
import { validateMeetingForEntity } from './meeting-hierarchy.util';
import { MeetingZoomService } from './meeting-zoom.service';
import { MeetingsCalendarSyncService } from './meetings-calendar-sync.service';
import { MeetingMinutesFileService } from './meeting-minutes-file.service';
import { buildMeetingIcs } from './meetings-ical.util';
import {
  meetingMinutesToDocxBuffer,
  meetingMinutesToPdfBuffer,
} from './meetings-minutes-export.util';
import { generateMinutesFromTranscript, minutesToPlainText } from './meetings-minutes.util';
import type { MinutesSchema } from './meetings-minutes.util';
import { MeetingsRepository } from './meetings.repository';

@Injectable()
export class MeetingsService {
  constructor(
    private readonly repo: MeetingsRepository,
    private readonly audit: AuditService,
    private readonly tenantModules: TenantModulesService,
    @Inject(forwardRef(() => WorkflowEngineService))
    private readonly workflows: WorkflowEngineService,
    private readonly minutesFiles: MeetingMinutesFileService,
    private readonly calendarSync: MeetingsCalendarSyncService,
    private readonly zoom: MeetingZoomService,
  ) {}

  async zoomSdkJoin(user: AuthUser, meetingId: string, entityId?: string) {
    await this.assertMeetingsModule(user.institutionId);
    const row = await this.repo.findMeeting(
      user.institutionId,
      meetingId,
      this.entityId(user, entityId),
    );
    if (!row) throw new NotFoundException('Meeting not found');
    if (!row.meetingLink) throw new BadRequestException('No conference link on this meeting');
    const meetingNumber = this.zoom.extractMeetingNumber(row.meetingLink);
    if (!meetingNumber) throw new BadRequestException('Not a Zoom meeting link');
    const signature = this.zoom.generateSdkSignature(meetingNumber, 0);
    const sdkKey = process.env.ZOOM_SDK_KEY?.trim() ?? process.env.ZOOM_CLIENT_ID?.trim();
    if (!signature || !sdkKey) {
      throw new BadRequestException('Zoom Meeting SDK is not configured');
    }
    return { sdkKey, signature, meetingNumber, joinUrl: row.meetingLink };
  }

  private async assertMeetingsModule(institutionId: string) {
    await this.tenantModules.assertEnabled(institutionId, TenantModule.MEETINGS);
  }

  private hasInstitutionScope(user: AuthUser) {
    return user.permissions?.includes('*') || user.permissions?.includes('institutions.write');
  }

  private entityId(user: AuthUser, override?: string) {
    if (override?.trim()) return override.trim();
    if (!user.entityId) {
      throw new BadRequestException('X-Entity-ID header is required for entity-scoped meetings');
    }
    return user.entityId;
  }

  private canConvene(user: AuthUser) {
    return (
      user.permissions?.includes('*') ||
      user.permissions?.includes('meetings.convene') ||
      user.permissions?.includes('meetings.write')
    );
  }

  private canRead(user: AuthUser) {
    return this.canConvene(user) || user.permissions?.includes('meetings.read');
  }

  private scopeEntityId(user: AuthUser, queryEntityId?: string) {
    if (this.canConvene(user) && !user.entityId) {
      return queryEntityId?.trim() || undefined;
    }
    return this.entityId(user, queryEntityId);
  }

  list(user: AuthUser, queryEntityId?: string) {
    void this.assertMeetingsModule(user.institutionId);
    if (!this.canRead(user)) throw new ForbiddenException('Requires meetings.read');
    const entityId = this.scopeEntityId(user, queryEntityId);
    return this.repo.listMeetings(user.institutionId, entityId).then((data) => ({ data }));
  }

  async getOne(user: AuthUser, id: string, queryEntityId?: string) {
    if (!this.canRead(user)) throw new ForbiddenException('Requires meetings.read');
    const entityId = this.scopeEntityId(user, queryEntityId);
    const row = await this.repo.findMeeting(user.institutionId, id, entityId);
    if (!row) throw new NotFoundException('Meeting not found');
    return row;
  }

  async create(user: AuthUser, dto: CreateMeetingDto) {
    await this.assertMeetingsModule(user.institutionId);
    if (!this.canConvene(user)) throw new ForbiddenException('Requires meetings.convene');
    const entityId = this.entityId(user);
    validateMeetingForEntity(dto.type, entityId, user.entityId, this.hasInstitutionScope(user));
    const scheduledAt = new Date(dto.scheduledAt);
    const durationMinutes = dto.durationMinutes ?? 60;
    const conference =
      dto.meetingLink != null
        ? { meetingLink: dto.meetingLink }
        : await this.calendarSync.provisionConference({
            institutionId: user.institutionId,
            entityId,
            convenerPositionId: dto.convenerPositionId,
            title: dto.title.trim(),
            scheduledAt,
            durationMinutes,
          });
    const row = await this.repo.createMeeting({
      institutionId: user.institutionId,
      entityId,
      title: dto.title.trim(),
      type: dto.type,
      convenerPositionId: dto.convenerPositionId,
      orgUnitId: dto.orgUnitId,
      committeeId: dto.committeeId,
      scheduledAt,
      durationMinutes,
      location: dto.location,
      meetingLink: conference.meetingLink,
      zoomMeetingId: conference.zoomMeetingId,
      googleCalendarEventId: conference.googleCalendarEventId,
      microsoftCalendarEventId: conference.microsoftCalendarEventId,
      quorumRequired: dto.quorumRequired ?? 0,
      isConfidential: dto.isConfidential ?? false,
      status: MeetingStatus.SCHEDULED,
    });
    this.audit.append({
      institutionId: user.institutionId,
      actorId: user.userId,
      action: 'meeting.created',
      entity: 'Meeting',
      entityId: row.id,
      newValues: { title: row.title, type: row.type },
    });
    return row;
  }

  async update(user: AuthUser, meetingId: string, dto: UpdateMeetingDto) {
    await this.assertMeetingsModule(user.institutionId);
    if (!this.canConvene(user)) throw new ForbiddenException('Requires meetings.convene');
    const entityId = this.scopeEntityId(user);
    const meeting = await this.repo.findMeeting(user.institutionId, meetingId, entityId);
    if (!meeting) throw new NotFoundException('Meeting not found');
    if (dto.type) {
      validateMeetingForEntity(
        dto.type,
        meeting.entityId,
        user.entityId,
        this.hasInstitutionScope(user),
      );
    }
    const data: Prisma.MeetingUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.scheduledAt) data.scheduledAt = new Date(dto.scheduledAt);
    if (dto.durationMinutes !== undefined) data.durationMinutes = dto.durationMinutes;
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.meetingLink !== undefined) data.meetingLink = dto.meetingLink;
    if (dto.quorumRequired !== undefined) data.quorumRequired = dto.quorumRequired;
    if (dto.status !== undefined) data.status = dto.status;
    const updated = await this.repo.updateMeeting(meetingId, data);
    await this.calendarSync.syncMeetingUpdate({
      id: updated.id,
      institutionId: updated.institutionId,
      entityId: updated.entityId,
      convenerPositionId: updated.convenerPositionId,
      title: updated.title,
      scheduledAt: updated.scheduledAt,
      durationMinutes: updated.durationMinutes,
      status: updated.status,
      zoomMeetingId: updated.zoomMeetingId,
      googleCalendarEventId: updated.googleCalendarEventId,
      microsoftCalendarEventId: updated.microsoftCalendarEventId,
    });
    return updated;
  }

  async remove(user: AuthUser, meetingId: string) {
    await this.assertMeetingsModule(user.institutionId);
    if (!this.canConvene(user)) throw new ForbiddenException('Requires meetings.convene');
    const entityId = this.scopeEntityId(user);
    const meeting = await this.repo.findMeeting(user.institutionId, meetingId, entityId);
    if (!meeting) throw new NotFoundException('Meeting not found');
    await this.calendarSync.syncMeetingDelete(meeting);
    return this.repo.updateMeeting(meetingId, {
      status: MeetingStatus.CANCELLED,
      deletedAt: new Date(),
    });
  }

  async startMeeting(user: AuthUser, meetingId: string) {
    await this.assertMeetingsModule(user.institutionId);
    if (!this.canConvene(user)) throw new ForbiddenException('Requires meetings.convene');
    const entityId = this.scopeEntityId(user);
    const meeting = await this.repo.findMeeting(user.institutionId, meetingId, entityId);
    if (!meeting) throw new NotFoundException('Meeting not found');
    return this.repo.updateMeeting(meetingId, { status: MeetingStatus.IN_PROGRESS });
  }

  async endMeeting(user: AuthUser, meetingId: string) {
    await this.assertMeetingsModule(user.institutionId);
    if (!this.canConvene(user)) throw new ForbiddenException('Requires meetings.convene');
    const entityId = this.scopeEntityId(user);
    const meeting = await this.repo.findMeeting(user.institutionId, meetingId, entityId);
    if (!meeting) throw new NotFoundException('Meeting not found');
    return this.repo.updateMeeting(meetingId, { status: MeetingStatus.COMPLETED });
  }

  async addAgendaItem(user: AuthUser, meetingId: string, dto: UpsertAgendaItemDto) {
    if (!this.canConvene(user)) throw new ForbiddenException('Requires meetings.convene');
    const entityId = this.scopeEntityId(user);
    const meeting = await this.repo.findMeeting(user.institutionId, meetingId, entityId);
    if (!meeting) throw new NotFoundException('Meeting not found');
    const maxOrder = meeting.agendaItems.reduce((m, i) => Math.max(m, i.order), -1);
    return this.repo.createAgendaItem({
      institutionId: meeting.institutionId,
      entityId: meeting.entityId,
      meetingId,
      itemNumber: dto.itemNumber,
      title: dto.title.trim(),
      description: dto.description,
      presenterId: dto.presenterId,
      duration: dto.duration ?? 15,
      order: dto.order ?? maxOrder + 1,
      type: dto.type,
    });
  }

  async updateAgendaItem(
    user: AuthUser,
    meetingId: string,
    agendaItemId: string,
    dto: UpsertAgendaItemDto,
  ) {
    if (!this.canConvene(user)) throw new ForbiddenException('Requires meetings.convene');
    const entityId = this.scopeEntityId(user);
    const meeting = await this.repo.findMeeting(user.institutionId, meetingId, entityId);
    if (!meeting) throw new NotFoundException('Meeting not found');
    const item = await this.repo.findAgendaItem(meetingId, agendaItemId);
    if (!item) throw new NotFoundException('Agenda item not found');
    return this.repo.updateAgendaItem(agendaItemId, {
      itemNumber: dto.itemNumber,
      title: dto.title.trim(),
      description: dto.description,
      presenterId: dto.presenterId,
      duration: dto.duration,
      order: dto.order,
      type: dto.type,
    });
  }

  async deleteAgendaItem(user: AuthUser, meetingId: string, agendaItemId: string) {
    if (!this.canConvene(user)) throw new ForbiddenException('Requires meetings.convene');
    const entityId = this.scopeEntityId(user);
    const meeting = await this.repo.findMeeting(user.institutionId, meetingId, entityId);
    if (!meeting) throw new NotFoundException('Meeting not found');
    const item = await this.repo.findAgendaItem(meetingId, agendaItemId);
    if (!item) throw new NotFoundException('Agenda item not found');
    await this.repo.deleteAgendaItem(agendaItemId);
    return { ok: true };
  }

  async reorderAgenda(user: AuthUser, meetingId: string, orderedIds: string[]) {
    if (!this.canConvene(user)) throw new ForbiddenException('Requires meetings.convene');
    const entityId = this.scopeEntityId(user);
    const meeting = await this.repo.findMeeting(user.institutionId, meetingId, entityId);
    if (!meeting) throw new NotFoundException('Meeting not found');
    await this.repo.reorderAgenda(meetingId, orderedIds);
    return this.repo.findMeeting(user.institutionId, meetingId, entityId);
  }

  async inviteAttendee(
    user: AuthUser,
    meetingId: string,
    body: { userId: string; positionId?: string; isRequired?: boolean },
  ) {
    if (!this.canConvene(user)) throw new ForbiddenException('Requires meetings.convene');
    const entityId = this.scopeEntityId(user);
    const meeting = await this.repo.findMeeting(user.institutionId, meetingId, entityId);
    if (!meeting) throw new NotFoundException('Meeting not found');
    return this.repo.upsertAttendee({
      institutionId: meeting.institutionId,
      entityId: meeting.entityId,
      meetingId,
      userId: body.userId,
      positionId: body.positionId,
      isRequired: body.isRequired ?? true,
      inviteStatus: InviteStatus.PENDING,
    });
  }

  async rsvp(user: AuthUser, meetingId: string, status: InviteStatus) {
    const entityId = this.scopeEntityId(user);
    const meeting = await this.repo.findMeeting(user.institutionId, meetingId, entityId);
    if (!meeting) throw new NotFoundException('Meeting not found');
    const attendee = meeting.attendees.find((a) => a.userId === user.userId);
    if (!attendee) throw new ForbiddenException('You are not invited to this meeting');
    return this.repo.updateAttendee(attendee.id, { inviteStatus: status });
  }

  async markAttendance(
    user: AuthUser,
    meetingId: string,
    body: { userId: string; attended: boolean; arrivalTime?: string; departureTime?: string },
  ) {
    if (!this.canConvene(user)) throw new ForbiddenException('Requires meetings.convene');
    const entityId = this.scopeEntityId(user);
    const meeting = await this.repo.findMeeting(user.institutionId, meetingId, entityId);
    if (!meeting) throw new NotFoundException('Meeting not found');
    const attendee = meeting.attendees.find((a) => a.userId === body.userId);
    if (!attendee) throw new NotFoundException('Attendee not found');
    const attended = await this.repo.updateAttendee(attendee.id, {
      attended: body.attended,
      arrivalTime: body.arrivalTime ? new Date(body.arrivalTime) : undefined,
      departureTime: body.departureTime ? new Date(body.departureTime) : undefined,
    });
    const present = meeting.attendees.filter(
      (a) => a.attended || (a.id === attendee.id && body.attended),
    );
    const quorumMet = meeting.quorumRequired > 0 ? present.length >= meeting.quorumRequired : null;
    if (quorumMet !== null) {
      await this.repo.updateMeeting(meetingId, { quorumMet });
    }
    return attended;
  }

  async createResolution(
    user: AuthUser,
    meetingId: string,
    body: {
      title: string;
      content: string;
      movedBy: string;
      secondedBy: string;
      agendaItemId?: string;
      votesFor?: number;
      votesAgainst?: number;
      abstentions?: number;
      outcome?: ResolutionOutcome;
    },
  ) {
    if (!this.canConvene(user)) throw new ForbiddenException('Requires meetings.convene');
    const entityId = this.scopeEntityId(user);
    const meeting = await this.repo.findMeeting(user.institutionId, meetingId, entityId);
    if (!meeting) throw new NotFoundException('Meeting not found');
    const resolutionNumber = await this.repo.nextResolutionNumber(user.institutionId);
    return this.repo.createResolution({
      institutionId: meeting.institutionId,
      entityId: meeting.entityId,
      meetingId,
      agendaItemId: body.agendaItemId,
      resolutionNumber,
      title: body.title.trim(),
      content: body.content.trim(),
      movedBy: body.movedBy,
      secondedBy: body.secondedBy,
      votesFor: body.votesFor ?? 0,
      votesAgainst: body.votesAgainst ?? 0,
      abstentions: body.abstentions ?? 0,
      outcome: body.outcome ?? ResolutionOutcome.PASSED,
    });
  }

  async voteResolution(
    user: AuthUser,
    meetingId: string,
    resolutionId: string,
    body: { votesFor: number; votesAgainst: number; abstentions: number },
  ) {
    if (!this.canConvene(user)) throw new ForbiddenException('Requires meetings.convene');
    const entityId = this.scopeEntityId(user);
    const meeting = await this.repo.findMeeting(user.institutionId, meetingId, entityId);
    if (!meeting) throw new NotFoundException('Meeting not found');
    const resolution = meeting.resolutions.find((r) => r.id === resolutionId);
    if (!resolution) throw new NotFoundException('Resolution not found');
    const votesFor = body.votesFor;
    const votesAgainst = body.votesAgainst;
    const outcome = votesFor > votesAgainst ? ResolutionOutcome.PASSED : ResolutionOutcome.FAILED;
    return this.repo.updateResolution(resolutionId, {
      votesFor,
      votesAgainst,
      abstentions: body.abstentions,
      outcome,
    });
  }

  resolutionRegister(user: AuthUser, q?: string, queryEntityId?: string) {
    if (!this.canRead(user)) throw new ForbiddenException('Requires meetings.read');
    const entityId = this.scopeEntityId(user, queryEntityId);
    return this.repo
      .searchResolutions(user.institutionId, { entityId, q })
      .then((data) => ({ data }));
  }

  async createActionItem(
    user: AuthUser,
    meetingId: string,
    body: { description: string; assignedToId?: string; dueDate?: string },
  ) {
    if (!this.canConvene(user)) throw new ForbiddenException('Requires meetings.convene');
    const entityId = this.scopeEntityId(user);
    const meeting = await this.repo.findMeeting(user.institutionId, meetingId, entityId);
    if (!meeting) throw new NotFoundException('Meeting not found');
    return this.repo.createActionItem({
      institutionId: meeting.institutionId,
      entityId: meeting.entityId,
      meetingId,
      description: body.description.trim(),
      assignedToId: body.assignedToId,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      status: MeetingActionStatus.OPEN,
    });
  }

  async updateActionItemStatus(user: AuthUser, actionItemId: string, status: MeetingActionStatus) {
    if (!this.canConvene(user)) throw new ForbiddenException('Requires meetings.convene');
    return this.repo.updateActionItem(actionItemId, { status });
  }

  async getMeetingAgenda(user: AuthUser, meetingId: string) {
    if (!this.canConvene(user)) throw new ForbiddenException('Requires meetings.convene');
    const entityId = this.scopeEntityId(user);
    const meeting = await this.repo.findMeeting(user.institutionId, meetingId, entityId);
    if (!meeting) throw new NotFoundException('Meeting not found');
    return {
      agenda: meeting.agendaItems.map((i) => ({
        itemNumber: i.itemNumber,
        title: i.title,
      })),
    };
  }

  async generateMinutes(user: AuthUser, meetingId: string, dto: GenerateMinutesDto) {
    if (!this.canConvene(user)) throw new ForbiddenException('Requires meetings.convene');
    const entityId = this.scopeEntityId(user);
    const meeting = await this.repo.findMeeting(user.institutionId, meetingId, entityId);
    if (!meeting) throw new NotFoundException('Meeting not found');
    const agenda = meeting.agendaItems.map((i) => ({ itemNumber: i.itemNumber, title: i.title }));
    const minutes = await generateMinutesFromTranscript(dto.transcript, agenda);
    return this.persistMinutesDraft(user, meetingId, minutes, { isAIGenerated: false });
  }

  /** Save structured minutes JSON + formatted plain-text draft to storage. */
  async persistMinutesDraft(
    user: AuthUser,
    meetingId: string,
    minutes: MinutesSchema,
    meta?: { isAIGenerated?: boolean },
  ) {
    if (!this.canConvene(user)) throw new ForbiddenException('Requires meetings.convene');
    const entityId = this.scopeEntityId(user);
    const meeting = await this.repo.findMeeting(user.institutionId, meetingId, entityId);
    if (!meeting) throw new NotFoundException('Meeting not found');

    const plain = minutesToPlainText(minutes, meeting.title);
    const file = await this.minutesFiles.storePlainTextMinutes(
      meeting.institutionId,
      meeting.entityId,
      meetingId,
      plain,
    );
    const row = await this.repo.updateMeeting(meetingId, {
      minutesDraft: minutes as unknown as Prisma.InputJsonValue,
      minutesDraftKey: file.minutesFileKey,
    });
    for (const ai of minutes.actionItems) {
      await this.repo.createActionItem({
        institutionId: meeting.institutionId,
        entityId: meeting.entityId,
        meetingId,
        description: ai.description,
        dueDate: ai.dueDate ? new Date(ai.dueDate) : undefined,
        status: MeetingActionStatus.OPEN,
      });
    }
    return {
      meeting: row,
      minutes,
      plainText: plain,
      minutesFile: file,
      isAIGenerated: meta?.isAIGenerated ?? false,
    };
  }

  async approveMinutes(user: AuthUser, meetingId: string) {
    if (!this.canConvene(user)) throw new ForbiddenException('Requires meetings.convene');
    const entityId = this.scopeEntityId(user);
    const meeting = await this.repo.findMeeting(user.institutionId, meetingId, entityId);
    if (!meeting) throw new NotFoundException('Meeting not found');
    if (!meeting.minutesDraft) throw new BadRequestException('No draft minutes to approve');
    const updated = await this.repo.updateMeeting(meetingId, {
      minutesApprovedAt: new Date(),
      minutesApprovedBy: user.userId,
      status: MeetingStatus.COMPLETED,
    });
    if (!meeting.workflowInstanceId) {
      const instance = await this.workflows.initiateWorkflow({
        institutionId: meeting.institutionId,
        entityId: meeting.entityId,
        definitionCode: 'MEETING_MINUTES_FILING',
        entityType: 'Meeting',
        entityId_record: meeting.id,
        initiatedBy: user.userId,
        metadata: { meetingId: meeting.id, title: meeting.title },
      });
      await this.repo.updateMeeting(meetingId, { workflowInstanceId: instance.id });
    }
    return updated;
  }

  async completeMinutesFilingFromWorkflow(
    institutionId: string,
    meetingId: string,
    actorUserId: string,
  ) {
    const meeting = await this.repo.findMeeting(institutionId, meetingId);
    if (!meeting) return;
    await this.repo.updateMeeting(meetingId, {
      registrarFiledAt: new Date(),
      registrarFiledBy: actorUserId,
      minutesFileKey: meeting.minutesDraftKey ?? meeting.minutesFileKey,
    });
  }

  private async resolveMinutesPlainText(meeting: {
    title: string;
    minutesDraft: unknown;
    minutesDraftKey?: string | null;
  }): Promise<string> {
    const stored = await this.minutesFiles.readPlainText(meeting.minutesDraftKey);
    if (stored) return stored;
    if (meeting.minutesDraft) {
      return minutesToPlainText(meeting.minutesDraft as MinutesSchema, meeting.title);
    }
    throw new BadRequestException('No minutes available to export');
  }

  async exportMinutesPdf(user: AuthUser, meetingId: string) {
    if (!this.canRead(user)) throw new ForbiddenException('Requires meetings.read');
    const entityId = this.scopeEntityId(user);
    const meeting = await this.repo.findMeeting(user.institutionId, meetingId, entityId);
    if (!meeting) throw new NotFoundException('Meeting not found');
    const plain = await this.resolveMinutesPlainText(meeting);
    const bytes = await meetingMinutesToPdfBuffer(meeting.title, plain);
    return {
      buffer: Buffer.from(bytes),
      filename: `${meeting.title.replace(/\s+/g, '-')}-minutes.pdf`,
    };
  }

  async exportMinutesDocx(user: AuthUser, meetingId: string) {
    if (!this.canRead(user)) throw new ForbiddenException('Requires meetings.read');
    const entityId = this.scopeEntityId(user);
    const meeting = await this.repo.findMeeting(user.institutionId, meetingId, entityId);
    if (!meeting) throw new NotFoundException('Meeting not found');
    const plain = await this.resolveMinutesPlainText(meeting);
    const buffer = await meetingMinutesToDocxBuffer(meeting.title, plain);
    return {
      buffer,
      filename: `${meeting.title.replace(/\s+/g, '-')}-minutes.docx`,
    };
  }

  async exportIcal(user: AuthUser, meetingId: string) {
    if (!this.canRead(user)) throw new ForbiddenException('Requires meetings.read');
    const entityId = this.scopeEntityId(user);
    const meeting = await this.repo.findMeeting(user.institutionId, meetingId, entityId);
    if (!meeting) throw new NotFoundException('Meeting not found');
    return buildMeetingIcs({
      uid: meeting.id,
      title: meeting.title,
      scheduledAt: meeting.scheduledAt,
      durationMinutes: meeting.durationMinutes,
      location: meeting.location,
      meetingLink: meeting.meetingLink,
    });
  }

  listCommittees(user: AuthUser, queryEntityId?: string) {
    if (!this.canRead(user)) throw new ForbiddenException('Requires meetings.read');
    const entityId = this.scopeEntityId(user, queryEntityId);
    return this.repo.listCommittees(user.institutionId, entityId).then((data) => ({ data }));
  }

  createCommittee(
    user: AuthUser,
    body: {
      name: string;
      type?: 'STANDING' | 'AD_HOC';
      orgUnitId?: string;
      memberUserIds?: string[];
      termStart?: string;
      termEnd?: string;
    },
  ) {
    if (!this.canConvene(user)) throw new ForbiddenException('Requires meetings.convene');
    const entityId = this.entityId(user);
    return this.repo.createCommittee({
      institutionId: user.institutionId,
      entityId,
      orgUnitId: body.orgUnitId,
      name: body.name.trim(),
      type: body.type,
      memberUserIds: body.memberUserIds ?? [],
      termStart: body.termStart ? new Date(body.termStart) : undefined,
      termEnd: body.termEnd ? new Date(body.termEnd) : undefined,
    });
  }

  async updateCommittee(
    user: AuthUser,
    committeeId: string,
    body: {
      name?: string;
      memberUserIds?: string[];
      isActive?: boolean;
      termEnd?: string;
    },
  ) {
    if (!this.canConvene(user)) throw new ForbiddenException('Requires meetings.convene');
    await this.assertMeetingsModule(user.institutionId);
    return this.repo.updateCommittee(committeeId, {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.memberUserIds !== undefined ? { memberUserIds: body.memberUserIds } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.termEnd ? { termEnd: new Date(body.termEnd) } : {}),
    });
  }
}
