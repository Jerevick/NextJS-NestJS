import { parseSectionSchedule, type TimetableSlot } from '../enrollment/timetable-conflict.util';

const DAY_TO_JS: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

export type TodayScheduleItem = {
  courseCode: string;
  courseTitle: string;
  room: string | null;
  startMinutes: number;
  endMinutes: number;
  startLabel: string;
  endLabel: string;
};

export function formatMinutesLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** Collect section schedule slots that fall on today's weekday. */
export function buildTodaySchedule(
  enrollments: Array<{
    section: {
      schedule: unknown;
      room: string | null;
      course: { code: string; title: string };
    };
  }>,
  now = new Date(),
): TodayScheduleItem[] {
  const jsDay = now.getDay();
  const items: TodayScheduleItem[] = [];

  for (const enr of enrollments) {
    const slots = parseSectionSchedule(enr.section.schedule);
    for (const slot of slots) {
      if (DAY_TO_JS[slot.day] !== jsDay) {
        continue;
      }
      items.push({
        courseCode: enr.section.course.code,
        courseTitle: enr.section.course.title,
        room: enr.section.room,
        startMinutes: slot.startMinutes,
        endMinutes: slot.endMinutes,
        startLabel: formatMinutesLabel(slot.startMinutes),
        endLabel: formatMinutesLabel(slot.endMinutes),
      });
    }
  }

  return items.sort((a, b) => a.startMinutes - b.startMinutes);
}

export function slotOverlapsToday(slot: TimetableSlot, now = new Date()): boolean {
  return DAY_TO_JS[slot.day] === now.getDay();
}
