import { BadRequestException } from '@nestjs/common';

/**
 * Normalize a classroom session calendar day to UTC midnight for stored Attendance.sessionDate rows.
 */
export function sessionDateUtcStart(iso: string): Date {
  const trimmed = iso.trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  if (m) {
    return new Date(`${m[1]}T00:00:00.000Z`);
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException('Invalid sessionDate');
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
