import type { TimetableEngineInput } from './timetabling-engine.util';

const DAY_MAP: Record<string, string> = {
  mon: 'MON',
  monday: 'MON',
  tue: 'TUE',
  tuesday: 'TUE',
  wed: 'WED',
  wednesday: 'WED',
  thu: 'THU',
  thursday: 'THU',
  fri: 'FRI',
  friday: 'FRI',
  sat: 'SAT',
  saturday: 'SAT',
  sun: 'SUN',
  sunday: 'SUN',
};

export type ParsedTimetableConstraints = {
  slotGrid?: TimetableEngineInput['slotGrid'];
  excludeDays: string[];
  notes: string[];
};

/** Parse free-text registrar constraints into slot-grid adjustments. */
export function parseTimetableConstraints(
  constraints: string[] | undefined,
): ParsedTimetableConstraints {
  const excludeDays = new Set<string>();
  const notes: string[] = [];
  let dayStartMinutes: number | undefined;
  let dayEndMinutes: number | undefined;

  for (const raw of constraints ?? []) {
    const line = raw.trim();
    if (!line) continue;
    const lower = line.toLowerCase();
    notes.push(line);

    const noDay =
      /\b(?:no|exclude|avoid)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i.exec(
        lower,
      );
    if (noDay) {
      const d = DAY_MAP[noDay[1]!.toLowerCase()];
      if (d) excludeDays.add(d);
    }
    if (/\bweekends?\b/.test(lower) || /\bno\s+weekends?\b/.test(lower)) {
      excludeDays.add('SAT');
      excludeDays.add('SUN');
    }
    if (/\bmorning\b/.test(lower)) {
      dayEndMinutes = Math.min(dayEndMinutes ?? 12 * 60, 12 * 60);
    }
    if (/\bafternoon\b/.test(lower) && !/\bmorning\b/.test(lower)) {
      dayStartMinutes = Math.max(dayStartMinutes ?? 12 * 60, 12 * 60);
    }
    if (/\bevening\b/.test(lower)) {
      dayStartMinutes = Math.max(dayStartMinutes ?? 17 * 60, 17 * 60);
    }
    const before = /\bbefore\s+(\d{1,2})(?::(\d{2}))?\b/i.exec(lower);
    if (before) {
      const h = Number(before[1]);
      const m = before[2] ? Number(before[2]) : 0;
      dayEndMinutes = Math.min(dayEndMinutes ?? h * 60 + m, h * 60 + m);
    }
    const after = /\bafter\s+(\d{1,2})(?::(\d{2}))?\b/i.exec(lower);
    if (after) {
      const h = Number(after[1]);
      const m = after[2] ? Number(after[2]) : 0;
      dayStartMinutes = Math.max(dayStartMinutes ?? h * 60 + m, h * 60 + m);
    }
  }

  const defaultDays = ['MON', 'TUE', 'WED', 'THU', 'FRI'].filter((d) => !excludeDays.has(d));
  return {
    excludeDays: [...excludeDays],
    notes,
    slotGrid: {
      days: defaultDays.length ? defaultDays : ['MON', 'TUE', 'WED', 'THU', 'FRI'],
      ...(dayStartMinutes !== undefined ? { dayStartMinutes } : {}),
      ...(dayEndMinutes !== undefined ? { dayEndMinutes } : {}),
    },
  };
}

export function mergeConstraintGrid(
  base: TimetableEngineInput['slotGrid'] | undefined,
  parsed: ParsedTimetableConstraints,
): TimetableEngineInput['slotGrid'] {
  return {
    ...parsed.slotGrid,
    ...base,
    days: base?.days ?? parsed.slotGrid?.days,
    dayStartMinutes: Math.max(
      base?.dayStartMinutes ?? 8 * 60,
      parsed.slotGrid?.dayStartMinutes ?? 8 * 60,
    ),
    dayEndMinutes: Math.min(
      base?.dayEndMinutes ?? 18 * 60,
      parsed.slotGrid?.dayEndMinutes ?? 18 * 60,
    ),
  };
}
