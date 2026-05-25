import { Injectable } from '@nestjs/common';
import {
  InviteStatus,
  MeetingActionStatus,
  MeetingStatus,
  Prisma,
  ResolutionOutcome,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MeetingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listMeetings(institutionId: string, entityId?: string) {
    return this.prisma.meeting.findMany({
      where: { institutionId, deletedAt: null, ...(entityId ? { entityId } : {}) },
      orderBy: { scheduledAt: 'desc' },
      include: {
        orgUnit: { select: { id: true, name: true, code: true } },
        convenerPosition: { select: { id: true, title: true, code: true } },
        agendaItems: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
        _count: { select: { attendees: true, actionItems: true } },
      },
    });
  }

  findMeeting(institutionId: string, id: string, entityId?: string) {
    return this.prisma.meeting.findFirst({
      where: { id, institutionId, deletedAt: null, ...(entityId ? { entityId } : {}) },
      include: {
        orgUnit: { select: { id: true, name: true, code: true } },
        convenerPosition: { select: { id: true, title: true, code: true } },
        attendees: {
          include: { user: { select: { id: true, email: true, profile: true } } },
        },
        agendaItems: { where: { deletedAt: null }, orderBy: { order: 'asc' } },
        actionItems: true,
        resolutions: true,
      },
    });
  }

  createMeeting(data: Prisma.MeetingUncheckedCreateInput) {
    return this.prisma.meeting.create({ data });
  }

  updateMeeting(id: string, data: Prisma.MeetingUncheckedUpdateInput) {
    return this.prisma.meeting.update({ where: { id }, data });
  }

  createAgendaItem(data: Prisma.AgendaItemUncheckedCreateInput) {
    return this.prisma.agendaItem.create({ data });
  }

  updateAgendaItem(id: string, data: Prisma.AgendaItemUncheckedUpdateInput) {
    return this.prisma.agendaItem.update({ where: { id }, data });
  }

  deleteAgendaItem(id: string) {
    return this.prisma.agendaItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  reorderAgenda(meetingId: string, orderedIds: string[]) {
    return this.prisma.$transaction(
      orderedIds.map((id, order) =>
        this.prisma.agendaItem.update({ where: { id, meetingId }, data: { order } }),
      ),
    );
  }

  upsertAttendee(data: Prisma.MeetingAttendeeUncheckedCreateInput) {
    return this.prisma.meetingAttendee.upsert({
      where: { meetingId_userId: { meetingId: data.meetingId, userId: data.userId } },
      create: data,
      update: {
        inviteStatus: data.inviteStatus,
        isRequired: data.isRequired,
        positionId: data.positionId,
      },
    });
  }

  updateAttendee(id: string, data: Prisma.MeetingAttendeeUncheckedUpdateInput) {
    return this.prisma.meetingAttendee.update({ where: { id }, data });
  }

  createResolution(data: Prisma.ResolutionUncheckedCreateInput) {
    return this.prisma.resolution.create({ data });
  }

  updateResolution(id: string, data: Prisma.ResolutionUncheckedUpdateInput) {
    return this.prisma.resolution.update({ where: { id }, data });
  }

  searchResolutions(
    institutionId: string,
    opts: { entityId?: string; q?: string; limit?: number },
  ) {
    const q = opts.q?.trim();
    return this.prisma.resolution.findMany({
      where: {
        institutionId,
        ...(opts.entityId ? { entityId: opts.entityId } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { content: { contains: q, mode: 'insensitive' } },
                { resolutionNumber: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 50,
      include: { meeting: { select: { id: true, title: true, scheduledAt: true } } },
    });
  }

  createActionItem(data: Prisma.MeetingActionItemUncheckedCreateInput) {
    return this.prisma.meetingActionItem.create({ data });
  }

  updateActionItem(id: string, data: Prisma.MeetingActionItemUncheckedUpdateInput) {
    return this.prisma.meetingActionItem.update({ where: { id }, data });
  }

  listCommittees(institutionId: string, entityId?: string) {
    return this.prisma.meetingCommittee.findMany({
      where: {
        institutionId,
        isActive: true,
        ...(entityId ? { OR: [{ entityId }, { entityId: null }] } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  createCommittee(data: Prisma.MeetingCommitteeUncheckedCreateInput) {
    return this.prisma.meetingCommittee.create({ data });
  }

  updateCommittee(id: string, data: Prisma.MeetingCommitteeUncheckedUpdateInput) {
    return this.prisma.meetingCommittee.update({ where: { id }, data });
  }

  findAgendaItem(meetingId: string, agendaItemId: string) {
    return this.prisma.agendaItem.findFirst({ where: { id: agendaItemId, meetingId } });
  }

  softDeleteMeeting(id: string) {
    return this.prisma.meeting.update({
      where: { id },
      data: { deletedAt: new Date(), status: MeetingStatus.CANCELLED },
    });
  }

  nextResolutionNumber(institutionId: string): Promise<string> {
    return this.prisma.resolution
      .count({ where: { institutionId } })
      .then((n) => `RES-${new Date().getFullYear()}-${String(n + 1).padStart(4, '0')}`);
  }
}

export { InviteStatus, MeetingActionStatus, ResolutionOutcome };
