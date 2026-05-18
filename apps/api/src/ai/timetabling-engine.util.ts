import { type TimetableSlot, parseSectionSchedule } from '../enrollment/timetable-conflict.util';

export type TimetableSectionInput = {
  id: string;
  courseCode: string;
  enrollments: number;
  instructorId?: string;
  durationMinutes?: number;
  /** Soft preference — higher score when placed on these days. */
  preferredDays?: string[];
};

export type TimetableRoomInput = {
  id: string;
  capacity: number;
};

export type TimetableAssignment = {
  sectionId: string;
  courseCode: string;
  roomId: string;
  day: string;
  startTime: string;
  endTime: string;
  instructorId?: string;
};

export type TimetableEngineOption = {
  score: number;
  assignments: TimetableAssignment[];
  metrics: {
    roomUtilization: number;
    facultySpread: number;
    studentConflictCount: number;
  };
};

export type TimetableEngineInput = {
  sections: TimetableSectionInput[];
  rooms: TimetableRoomInput[];
  /** Already placed sections (fixed) — must not clash. */
  existing?: Array<{
    sectionId: string;
    courseCode?: string;
    instructorId?: string;
    roomId?: string;
    schedule: unknown;
  }>;
  /** Section groups that share students — no overlaps within a group. */
  studentOverlapGroups?: string[][];
  facultyAvailability?: Record<string, string[]>;
  slotGrid?: {
    days?: string[];
    dayStartMinutes?: number;
    dayEndMinutes?: number;
    slotMinutes?: number;
  };
  maxOptions?: number;
  maxAttempts?: number;
  /** Parsed registrar constraint notes (informational). */
  constraintNotes?: string[];
};

const DEFAULT_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function slotsOverlap(a: TimetableSlot, b: TimetableSlot): boolean {
  if (a.day !== b.day) return false;
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

function buildSlotGrid(config?: TimetableEngineInput['slotGrid']): TimetableSlot[] {
  const days = config?.days ?? DEFAULT_DAYS;
  const start = config?.dayStartMinutes ?? 8 * 60;
  const end = config?.dayEndMinutes ?? 18 * 60;
  const len = config?.slotMinutes ?? 60;
  const out: TimetableSlot[] = [];
  for (const day of days) {
    for (let t = start; t + len <= end; t += len) {
      out.push({ day, startMinutes: t, endMinutes: t + len });
    }
  }
  return out;
}

function parseAvailabilityWindow(raw: string): TimetableSlot | null {
  const m = /^([A-Za-z]+)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(raw.trim());
  if (!m) return null;
  const day = m[1]!.toUpperCase().slice(0, 3);
  const startParts = m[2]!.split(':').map(Number);
  const endParts = m[3]!.split(':').map(Number);
  const startMinutes = startParts[0]! * 60 + startParts[1]!;
  const endMinutes = endParts[0]! * 60 + endParts[1]!;
  if (endMinutes <= startMinutes) return null;
  return { day, startMinutes, endMinutes };
}

function facultyAvailable(
  instructorId: string | undefined,
  slot: TimetableSlot,
  availability: Record<string, string[]> | undefined,
): boolean {
  if (!instructorId || !availability?.[instructorId]?.length) return true;
  return availability[instructorId]!.some((w) => {
    const window = parseAvailabilityWindow(w);
    return window && window.day === slot.day && slotsOverlap(slot, window);
  });
}

type Placed = {
  sectionId: string;
  courseCode: string;
  roomId: string;
  instructorId?: string;
  slot: TimetableSlot;
  enrollments: number;
};

function hardClash(candidate: Placed, others: Placed[], rooms: Map<string, number>): boolean {
  if ((rooms.get(candidate.roomId) ?? 0) < candidate.enrollments) return true;
  for (const o of others) {
    if (!slotsOverlap(candidate.slot, o.slot)) continue;
    if (o.roomId === candidate.roomId) return true;
    if (candidate.instructorId && o.instructorId && candidate.instructorId === o.instructorId) {
      return true;
    }
  }
  return false;
}

function studentGroupsClash(
  sectionId: string,
  slot: TimetableSlot,
  placed: Placed[],
  groups: string[][],
): boolean {
  for (const group of groups) {
    if (!group.includes(sectionId)) continue;
    for (const otherId of group) {
      if (otherId === sectionId) continue;
      const other = placed.find((p) => p.sectionId === otherId);
      if (other && slotsOverlap(slot, other.slot)) return true;
    }
  }
  return false;
}

function scoreSolution(
  placed: Placed[],
  rooms: Map<string, number>,
  sections: TimetableSectionInput[],
): TimetableEngineOption['metrics'] & { score: number } {
  let roomUtilization = 0;
  for (const p of placed) {
    const cap = rooms.get(p.roomId) ?? 1;
    roomUtilization += Math.min(1, p.enrollments / cap);
  }
  roomUtilization = placed.length ? roomUtilization / placed.length : 0;

  const loadByInstructor = new Map<string, number>();
  for (const p of placed) {
    if (!p.instructorId) continue;
    loadByInstructor.set(p.instructorId, (loadByInstructor.get(p.instructorId) ?? 0) + 1);
  }
  const loads = [...loadByInstructor.values()];
  const avg = loads.length ? loads.reduce((a, b) => a + b, 0) / loads.length : 0;
  const variance = loads.length ? loads.reduce((s, l) => s + (l - avg) ** 2, 0) / loads.length : 0;
  const facultySpread = Math.max(0, 10 - variance);

  const pref = new Map(sections.map((s) => [s.id, s.preferredDays ?? []]));
  let prefHits = 0;
  for (const p of placed) {
    if (pref.get(p.sectionId)?.includes(p.slot.day)) prefHits++;
  }
  const prefScore = placed.length ? (prefHits / placed.length) * 15 : 0;

  const score = roomUtilization * 40 + facultySpread * 5 + prefScore + placed.length * 2;
  return {
    score,
    roomUtilization,
    facultySpread,
    studentConflictCount: 0,
  };
}

function existingToPlaced(
  existing: TimetableEngineInput['existing'],
  rooms: TimetableRoomInput[],
): Placed[] {
  const roomIds = new Set(rooms.map((r) => r.id));
  const out: Placed[] = [];
  for (const ex of existing ?? []) {
    const slots = parseSectionSchedule(ex.schedule);
    for (const slot of slots) {
      out.push({
        sectionId: ex.sectionId,
        courseCode: ex.courseCode ?? ex.sectionId,
        roomId: ex.roomId ?? `fixed-${ex.sectionId}`,
        instructorId: ex.instructorId,
        slot,
        enrollments: 0,
      });
    }
    void roomIds;
  }
  return out;
}

function backtrack(
  sections: TimetableSectionInput[],
  index: number,
  placed: Placed[],
  slots: TimetableSlot[],
  rooms: Map<string, number>,
  availability: Record<string, string[]> | undefined,
  groups: string[][],
  solutions: Placed[][],
  maxSolutions: number,
): void {
  if (solutions.length >= maxSolutions) return;
  if (index >= sections.length) {
    solutions.push(placed.map((p) => ({ ...p })));
    return;
  }
  const section = sections[index]!;
  const duration = section.durationMinutes ?? 60;
  const roomList = [...rooms.keys()].filter((id) => rooms.get(id)! >= section.enrollments);

  for (const roomId of roomList) {
    for (const slot of slots) {
      if (slot.endMinutes - slot.startMinutes < duration) continue;
      const useSlot: TimetableSlot = {
        day: slot.day,
        startMinutes: slot.startMinutes,
        endMinutes: slot.startMinutes + duration,
      };
      if (!facultyAvailable(section.instructorId, useSlot, availability)) continue;

      const candidate: Placed = {
        sectionId: section.id,
        courseCode: section.courseCode,
        roomId,
        instructorId: section.instructorId,
        slot: useSlot,
        enrollments: section.enrollments,
      };
      if (hardClash(candidate, placed, rooms)) continue;
      if (studentGroupsClash(section.id, useSlot, placed, groups)) continue;

      placed.push(candidate);
      backtrack(
        sections,
        index + 1,
        placed,
        slots,
        rooms,
        availability,
        groups,
        solutions,
        maxSolutions,
      );
      placed.pop();
    }
  }
}

/** Constraint-satisfaction timetabler — returns ranked conflict-free options. */
export function generateTimetableOptions(input: TimetableEngineInput): TimetableEngineOption[] {
  const rooms = new Map(input.rooms.map((r) => [r.id, r.capacity]));
  const slots = buildSlotGrid(input.slotGrid);
  const groups = input.studentOverlapGroups ?? [];
  const maxOptions = input.maxOptions ?? 3;

  const sorted = [...input.sections].sort((a, b) => {
    const score = (s: TimetableSectionInput) => (s.instructorId ? 10 : 0) + s.enrollments;
    return score(b) - score(a);
  });

  const seedPlaced = existingToPlaced(input.existing, input.rooms);
  const solutions: Placed[][] = [];

  const orderings = [
    sorted,
    [...sorted].reverse(),
    [...sorted].sort((a, b) => a.courseCode.localeCompare(b.courseCode)),
  ];

  for (const ordering of orderings) {
    if (solutions.length >= maxOptions) break;
    backtrack(
      ordering,
      0,
      [...seedPlaced],
      slots,
      rooms,
      input.facultyAvailability,
      groups,
      solutions,
      maxOptions,
    );
  }

  const unique = new Map<string, Placed[]>();
  for (const sol of solutions) {
    const key = sol
      .filter((p) => orderingIncludes(input.sections, p.sectionId))
      .map((p) => `${p.sectionId}:${p.roomId}:${p.slot.day}:${p.slot.startMinutes}`)
      .sort()
      .join('|');
    if (!unique.has(key)) unique.set(key, sol);
  }

  const options: TimetableEngineOption[] = [];
  for (const placed of unique.values()) {
    const scheduled = placed.filter((p) => orderingIncludes(input.sections, p.sectionId));
    const metrics = scoreSolution(scheduled, rooms, input.sections);
    options.push({
      score: Math.round(metrics.score * 10) / 10,
      assignments: scheduled.map((p) => ({
        sectionId: p.sectionId,
        courseCode: p.courseCode,
        roomId: p.roomId,
        day: p.slot.day,
        startTime: minutesToLabel(p.slot.startMinutes),
        endTime: minutesToLabel(p.slot.endMinutes),
        instructorId: p.instructorId,
      })),
      metrics: {
        roomUtilization: metrics.roomUtilization,
        facultySpread: metrics.facultySpread,
        studentConflictCount: metrics.studentConflictCount,
      },
    });
  }

  return options.sort((a, b) => b.score - a.score).slice(0, maxOptions);
}

function orderingIncludes(sections: TimetableSectionInput[], id: string): boolean {
  return sections.some((s) => s.id === id);
}

/** Validate a proposed set of assignments against hard constraints. */
export function validateTimetableAssignments(
  input: Omit<TimetableEngineInput, 'sections' | 'maxOptions' | 'maxAttempts'>,
  assignments: TimetableAssignment[],
): { valid: boolean; violations: string[] } {
  const rooms = new Map(input.rooms.map((r) => [r.id, r.capacity]));
  const placed: Placed[] = [
    ...existingToPlaced(input.existing, input.rooms),
    ...assignments.map((a) => ({
      sectionId: a.sectionId,
      courseCode: a.courseCode,
      roomId: a.roomId,
      instructorId: a.instructorId,
      slot: {
        day: a.day,
        startMinutes: parseTime(a.startTime),
        endMinutes: parseTime(a.endTime),
      },
      enrollments: 0,
    })),
  ];

  const violations: string[] = [];
  for (let i = 0; i < placed.length; i++) {
    const p = placed[i]!;
    if ((rooms.get(p.roomId) ?? 0) < p.enrollments) {
      violations.push(`Room ${p.roomId} under capacity for ${p.sectionId}`);
    }
    for (let j = i + 1; j < placed.length; j++) {
      const q = placed[j]!;
      if (!slotsOverlap(p.slot, q.slot)) continue;
      if (p.roomId === q.roomId) {
        violations.push(`Room clash ${p.roomId} on ${p.slot.day}`);
      }
      if (p.instructorId && p.instructorId === q.instructorId) {
        violations.push(`Instructor clash ${p.instructorId} on ${p.slot.day}`);
      }
    }
  }
  return { valid: violations.length === 0, violations };
}

function parseTime(value: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}
