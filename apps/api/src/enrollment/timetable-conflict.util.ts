export type TimetableSlot = {
  day: string;
  startMinutes: number;
  endMinutes: number;
};

const DAY_ALIASES: Record<string, string> = {
  mon: 'MON',
  monday: 'MON',
  tue: 'TUE',
  tues: 'TUE',
  tuesday: 'TUE',
  wed: 'WED',
  wednesday: 'WED',
  thu: 'THU',
  thur: 'THU',
  thurs: 'THU',
  thursday: 'THU',
  fri: 'FRI',
  friday: 'FRI',
  sat: 'SAT',
  saturday: 'SAT',
  sun: 'SUN',
  sunday: 'SUN',
};

function normalizeDay(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  if (DAY_ALIASES[key]) {
    return DAY_ALIASES[key];
  }
  const upper = raw.trim().toUpperCase();
  if (upper.length >= 3 && upper.length <= 9) {
    return DAY_ALIASES[upper.toLowerCase()] ?? upper.slice(0, 3);
  }
  return null;
}

function parseTimeToMinutes(value: unknown): number | null {
  if (typeof value !== 'string') {
    return null;
  }
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) {
    return null;
  }
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) {
    return null;
  }
  return h * 60 + min;
}

function pushSlot(slots: TimetableSlot[], day: string, start: unknown, end: unknown): void {
  const d = normalizeDay(day);
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (!d || startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return;
  }
  slots.push({ day: d, startMinutes, endMinutes });
}

/** Parse section.schedule JSON into normalized weekly slots. */
export function parseSectionSchedule(schedule: unknown): TimetableSlot[] {
  if (!schedule || typeof schedule !== 'object') {
    return [];
  }
  const s = schedule as Record<string, unknown>;
  const slots: TimetableSlot[] = [];

  if (Array.isArray(s.slots)) {
    for (const item of s.slots) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const row = item as Record<string, unknown>;
      pushSlot(
        slots,
        String(row.day ?? row.weekday ?? ''),
        row.start ?? row.startTime,
        row.end ?? row.endTime,
      );
    }
    return slots;
  }

  const daysRaw = s.days;
  const days: string[] = Array.isArray(daysRaw)
    ? daysRaw.map((d) => String(d))
    : typeof daysRaw === 'string'
      ? daysRaw.split(/[,;]+/).map((d) => d.trim())
      : [];

  const start = s.startTime ?? s.start;
  const end = s.endTime ?? s.end;
  if (days.length > 0) {
    for (const day of days) {
      pushSlot(slots, day, start, end);
    }
    return slots;
  }

  if (s.day && start && end) {
    pushSlot(slots, String(s.day), start, end);
  }

  return slots;
}

function slotsOverlap(a: TimetableSlot, b: TimetableSlot): boolean {
  if (a.day !== b.day) {
    return false;
  }
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

export type TimetableConflict = {
  existingSectionId: string;
  existingCourseCode: string;
  day: string;
  existingStart: string;
  existingEnd: string;
  newStart: string;
  newEnd: string;
};

function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function findTimetableConflicts(
  existing: Array<{ sectionId: string; courseCode: string; schedule: unknown }>,
  candidate: { sectionId: string; schedule: unknown },
): TimetableConflict[] {
  const newSlots = parseSectionSchedule(candidate.schedule);
  if (newSlots.length === 0) {
    return [];
  }
  const conflicts: TimetableConflict[] = [];
  for (const enr of existing) {
    if (enr.sectionId === candidate.sectionId) {
      continue;
    }
    const existingSlots = parseSectionSchedule(enr.schedule);
    for (const ns of newSlots) {
      for (const es of existingSlots) {
        if (slotsOverlap(ns, es)) {
          conflicts.push({
            existingSectionId: enr.sectionId,
            existingCourseCode: enr.courseCode,
            day: ns.day,
            existingStart: minutesToLabel(es.startMinutes),
            existingEnd: minutesToLabel(es.endMinutes),
            newStart: minutesToLabel(ns.startMinutes),
            newEnd: minutesToLabel(ns.endMinutes),
          });
        }
      }
    }
  }
  return conflicts;
}
