import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { InviteStatus, MeetingActionStatus, ResolutionOutcome } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { GenerateMinutesDto } from './dto/generate-minutes.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { UpsertAgendaItemDto } from './dto/upsert-agenda-item.dto';
import { MeetingsService } from './meetings.service';

/** Phase 11 meetings — agenda, attendance, resolutions, AI minutes. */
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('meetings')
@UseGuards(PermissionsGuard)
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Get()
  @RequirePermissions('meetings.read', 'meetings.convene', 'meetings.write')
  list(@CurrentUser() user: AuthUser, @Query('entityId') entityId?: string) {
    return this.meetings.list(user, entityId);
  }

  @Get('resolutions/register')
  @RequirePermissions('meetings.read', 'meetings.convene', 'meetings.write')
  resolutionRegister(
    @CurrentUser() user: AuthUser,
    @Query('q') q?: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.meetings.resolutionRegister(user, q, entityId);
  }

  @Get('committees')
  @RequirePermissions('meetings.read', 'meetings.convene', 'meetings.write')
  committees(@CurrentUser() user: AuthUser, @Query('entityId') entityId?: string) {
    return this.meetings.listCommittees(user, entityId);
  }

  @Patch('committees/:committeeId')
  @RequirePermissions('meetings.convene', 'meetings.write')
  updateCommittee(
    @CurrentUser() user: AuthUser,
    @Param('committeeId') committeeId: string,
    @Body()
    body: { name?: string; memberUserIds?: string[]; isActive?: boolean; termEnd?: string },
  ) {
    return this.meetings.updateCommittee(user, committeeId, body);
  }

  @Post('committees')
  @RequirePermissions('meetings.convene', 'meetings.write')
  createCommittee(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      name: string;
      type?: 'STANDING' | 'AD_HOC';
      orgUnitId?: string;
      memberUserIds?: string[];
      termStart?: string;
      termEnd?: string;
    },
  ) {
    return this.meetings.createCommittee(user, body);
  }

  @Post()
  @RequirePermissions('meetings.convene', 'meetings.write')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMeetingDto) {
    return this.meetings.create(user, dto);
  }

  @Get(':id/zoom-sdk')
  @RequirePermissions('meetings.read', 'meetings.convene', 'meetings.write')
  zoomSdk(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.meetings.zoomSdkJoin(user, id, entityId);
  }

  @Get(':id')
  @RequirePermissions('meetings.read', 'meetings.convene', 'meetings.write')
  getOne(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.meetings.getOne(user, id, entityId);
  }

  @Patch(':id')
  @RequirePermissions('meetings.convene', 'meetings.write')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateMeetingDto) {
    return this.meetings.update(user, id, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions('meetings.convene', 'meetings.write')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.meetings.remove(user, id);
  }

  @Post(':id/start')
  @RequirePermissions('meetings.convene', 'meetings.write')
  start(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.meetings.startMeeting(user, id);
  }

  @Post(':id/end')
  @RequirePermissions('meetings.convene', 'meetings.write')
  end(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.meetings.endMeeting(user, id);
  }

  @Post(':id/agenda')
  @RequirePermissions('meetings.convene', 'meetings.write')
  addAgenda(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpsertAgendaItemDto,
  ) {
    return this.meetings.addAgendaItem(user, id, dto);
  }

  @Patch(':id/agenda/:agendaItemId')
  @RequirePermissions('meetings.convene', 'meetings.write')
  updateAgenda(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('agendaItemId') agendaItemId: string,
    @Body() dto: UpsertAgendaItemDto,
  ) {
    return this.meetings.updateAgendaItem(user, id, agendaItemId, dto);
  }

  @Post(':id/agenda/:agendaItemId/delete')
  @RequirePermissions('meetings.convene', 'meetings.write')
  deleteAgenda(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('agendaItemId') agendaItemId: string,
  ) {
    return this.meetings.deleteAgendaItem(user, id, agendaItemId);
  }

  @Patch(':id/agenda/reorder')
  @RequirePermissions('meetings.convene', 'meetings.write')
  reorderAgenda(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { orderedIds: string[] },
  ) {
    return this.meetings.reorderAgenda(user, id, body.orderedIds ?? []);
  }

  @Post(':id/attendees')
  @RequirePermissions('meetings.convene', 'meetings.write')
  invite(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { userId: string; positionId?: string; isRequired?: boolean },
  ) {
    return this.meetings.inviteAttendee(user, id, body);
  }

  @Patch(':id/rsvp')
  @RequirePermissions('meetings.read', 'meetings.convene', 'meetings.write')
  rsvp(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { status: InviteStatus },
  ) {
    return this.meetings.rsvp(user, id, body.status);
  }

  @Patch(':id/attendance')
  @RequirePermissions('meetings.convene', 'meetings.write')
  attendance(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    body: {
      userId: string;
      attended: boolean;
      arrivalTime?: string;
      departureTime?: string;
    },
  ) {
    return this.meetings.markAttendance(user, id, body);
  }

  @Post(':id/resolutions')
  @RequirePermissions('meetings.convene', 'meetings.write')
  createResolution(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
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
    return this.meetings.createResolution(user, id, body);
  }

  @Patch(':id/resolutions/:resolutionId/vote')
  @RequirePermissions('meetings.convene', 'meetings.write')
  voteResolution(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('resolutionId') resolutionId: string,
    @Body() body: { votesFor: number; votesAgainst: number; abstentions: number },
  ) {
    return this.meetings.voteResolution(user, id, resolutionId, body);
  }

  @Post(':id/action-items')
  @RequirePermissions('meetings.convene', 'meetings.write')
  actionItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { description: string; assignedToId?: string; dueDate?: string },
  ) {
    return this.meetings.createActionItem(user, id, body);
  }

  @Patch('action-items/:actionItemId')
  @RequirePermissions('meetings.convene', 'meetings.write')
  updateActionItem(
    @CurrentUser() user: AuthUser,
    @Param('actionItemId') actionItemId: string,
    @Body() body: { status: MeetingActionStatus },
  ) {
    return this.meetings.updateActionItemStatus(user, actionItemId, body.status);
  }

  @Post(':id/generate-minutes')
  @RequirePermissions('meetings.convene', 'meetings.write')
  generateMinutes(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: GenerateMinutesDto,
  ) {
    return this.meetings.generateMinutes(user, id, dto);
  }

  @Post(':id/minutes/approve')
  @RequirePermissions('meetings.convene', 'meetings.write')
  approveMinutes(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.meetings.approveMinutes(user, id);
  }

  @Get(':id/minutes.pdf')
  @RequirePermissions('meetings.read', 'meetings.convene', 'meetings.write')
  async minutesPdf(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.meetings.exportMinutesPdf(user, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get(':id/minutes.docx')
  @RequirePermissions('meetings.read', 'meetings.convene', 'meetings.write')
  async minutesDocx(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.meetings.exportMinutesDocx(user, id);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get(':id/ical')
  @RequirePermissions('meetings.read', 'meetings.convene', 'meetings.write')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="meeting.ics"')
  async ical(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.meetings.exportIcal(user, id);
  }
}
