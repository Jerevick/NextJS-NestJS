import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { GenerateMinutesDto } from '../meetings/dto/generate-minutes.dto';
import { MeetingsService } from '../meetings/meetings.service';
import { GenerateAiMinutesDto } from './dto/generate-ai-minutes.dto';
import { AiMeetingsMinutesService } from './ai-meetings-minutes.service';

/** AI meeting minutes — structured JSON extraction and formatted draft. */
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('ai/meetings')
@UseGuards(PermissionsGuard)
export class AiMeetingsController {
  constructor(
    private readonly meetings: MeetingsService,
    private readonly aiMinutes: AiMeetingsMinutesService,
  ) {}

  /** Spec: POST /ai/meetings/generate-minutes { meetingId, transcript } */
  @Post('generate-minutes')
  @RequirePermissions('meetings.convene', 'meetings.write')
  async generateMinutesBody(@CurrentUser() user: AuthUser, @Body() dto: GenerateAiMinutesDto) {
    const meeting = await this.meetings.getMeetingAgenda(user, dto.meetingId);
    const { minutes, isAIGenerated } = await this.aiMinutes.extractStructuredMinutes(
      user.institutionId,
      dto.transcript,
      meeting.agenda,
    );
    const saved = await this.meetings.persistMinutesDraft(user, dto.meetingId, minutes, {
      isAIGenerated,
    });
    return {
      meetingId: dto.meetingId,
      minutes: saved.minutes,
      plainText: saved.plainText,
      minutesFile: saved.minutesFile,
      meeting: saved.meeting,
      isAIGenerated: saved.isAIGenerated,
    };
  }

  /** Legacy path — same pipeline as generate-minutes. */
  @Post(':id/generate-minutes')
  @RequirePermissions('meetings.convene', 'meetings.write')
  async generateMinutesByPath(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: GenerateMinutesDto,
  ) {
    const meeting = await this.meetings.getMeetingAgenda(user, id);
    const { minutes, isAIGenerated } = await this.aiMinutes.extractStructuredMinutes(
      user.institutionId,
      dto.transcript,
      meeting.agenda,
    );
    const saved = await this.meetings.persistMinutesDraft(user, id, minutes, {
      isAIGenerated,
    });
    return {
      meetingId: id,
      minutes: saved.minutes,
      plainText: saved.plainText,
      minutesFile: saved.minutesFile,
      meeting: saved.meeting,
      isAIGenerated: saved.isAIGenerated,
    };
  }
}
