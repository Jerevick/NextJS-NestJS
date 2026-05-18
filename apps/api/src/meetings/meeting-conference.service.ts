import { Injectable } from '@nestjs/common';
import {
  ConferenceProvisionResult,
  MeetingsCalendarSyncService,
} from './meetings-calendar-sync.service';

/** @deprecated Use MeetingsCalendarSyncService directly */
@Injectable()
export class MeetingConferenceService {
  constructor(private readonly sync: MeetingsCalendarSyncService) {}

  resolveOnlineMeetingLink(args: {
    institutionId: string;
    entityId: string;
    convenerPositionId: string;
    title: string;
    scheduledAt: Date;
    durationMinutes: number;
  }): Promise<string | undefined> {
    return this.sync.provisionConference(args).then((r) => r.meetingLink);
  }

  provisionConference(args: {
    institutionId: string;
    entityId: string;
    convenerPositionId: string;
    title: string;
    scheduledAt: Date;
    durationMinutes: number;
  }): Promise<ConferenceProvisionResult> {
    return this.sync.provisionConference(args);
  }
}
