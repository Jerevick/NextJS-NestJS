import { BadRequestException } from '@nestjs/common';
import { MeetingType } from '@prisma/client';

const INSTITUTION_WIDE_TYPES = new Set<MeetingType>([
  MeetingType.SENATE,
  MeetingType.ACADEMIC_BOARD,
]);

export function assertMeetingTypeScope(type: MeetingType, scope: 'create' | 'convene') {
  if (INSTITUTION_WIDE_TYPES.has(type) && scope === 'create') {
    return { institutionWide: true as const };
  }
  return { institutionWide: false as const };
}

export function validateMeetingForEntity(
  type: MeetingType,
  meetingEntityId: string,
  actorEntityId: string | undefined,
  actorHasInstitutionScope: boolean,
) {
  if (INSTITUTION_WIDE_TYPES.has(type)) {
    if (!actorHasInstitutionScope && actorEntityId && actorEntityId !== meetingEntityId) {
      throw new BadRequestException(
        `${type} meetings are institution-wide; convene from the host campus or with institution scope`,
      );
    }
    return;
  }
  if (actorEntityId && actorEntityId !== meetingEntityId) {
    throw new BadRequestException('This meeting type must be scoped to your campus entity');
  }
}
