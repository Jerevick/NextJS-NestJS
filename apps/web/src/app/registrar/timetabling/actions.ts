'use server';

import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { hasPermission } from '@/lib/permissions';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type TimetableAssistantState = {
  error?: string;
  result?: TimetableGenerateResult;
  applied?: { count: number };
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

export type TimetableOption = {
  score: number;
  assignments: TimetableAssignment[];
  metrics: {
    roomUtilization: number;
    facultySpread: number;
    studentConflictCount: number;
  };
};

export type TimetableGenerateResult = {
  semesterId: string;
  sectionsToSchedule: number;
  options: TimetableOption[];
  engine: string;
  constraintsApplied?: { excludeDays: string[]; notes: string[] };
  narrative?: string;
  isAIGenerated?: boolean;
};

function apiHeaders(session: NonNullable<Awaited<ReturnType<typeof auth>>>) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session!.accessToken ?? ''}`,
    'Content-Type': 'application/json',
  };
  if (session?.user?.institutionId) {
    headers['X-Institution-ID'] = session.user.institutionId;
  }
  appendOptionalEntityHeader(headers, session!.user);
  return headers;
}

function canTimetable(permissions: string[] | undefined) {
  return (
    hasPermission(permissions, 'academic.write') || hasPermission(permissions, 'enrollments.write')
  );
}

export async function generateSemesterTimetable(
  _prev: TimetableAssistantState,
  formData: FormData,
): Promise<TimetableAssistantState> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'You are not signed in.' };
  if (!canTimetable(session.user.permissions)) {
    return { error: 'You need academic.write or enrollments.write.' };
  }

  const semesterId = String(formData.get('semesterId') ?? '').trim();
  if (!semesterId) return { error: 'Select a semester.' };

  const constraintsRaw = String(formData.get('constraints') ?? '').trim();
  const constraints = constraintsRaw
    ? constraintsRaw
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    : undefined;
  const includeAiNarrative = formData.get('includeAiNarrative') === 'on';

  const res = await fetch(`${apiBase}/ai/timetabling/generate/semester/${semesterId}`, {
    method: 'POST',
    headers: apiHeaders(session),
    body: JSON.stringify({
      semesterId,
      onlyUnscheduled: true,
      maxOptions: 3,
      constraints,
      includeAiNarrative,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    return { error: parseApiError(raw, res.status) };
  }
  try {
    return { result: JSON.parse(raw) as TimetableGenerateResult };
  } catch {
    return { error: 'Unexpected response from API.' };
  }
}

export async function applyTimetableOption(
  _prev: TimetableAssistantState,
  formData: FormData,
): Promise<TimetableAssistantState> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'You are not signed in.' };
  if (!canTimetable(session.user.permissions)) {
    return { error: 'You need academic.write or enrollments.write.' };
  }

  const optionJson = String(formData.get('optionJson') ?? '');
  if (!optionJson) return { error: 'No option selected.' };

  let option: TimetableOption;
  try {
    option = JSON.parse(optionJson) as TimetableOption;
  } catch {
    return { error: 'Invalid option payload.' };
  }

  const res = await fetch(`${apiBase}/ai/timetabling/apply`, {
    method: 'POST',
    headers: apiHeaders(session),
    body: JSON.stringify({ option }),
  });

  const raw = await res.text();
  if (!res.ok) {
    return { error: parseApiError(raw, res.status) };
  }
  try {
    const applied = JSON.parse(raw) as { applied: number };
    return { applied: { count: applied.applied } };
  } catch {
    return { applied: { count: option.assignments.length } };
  }
}

function parseApiError(raw: string, status: number): string {
  let message = `Request failed (${status}).`;
  try {
    const j = JSON.parse(raw) as { message?: string | string[] };
    if (typeof j.message === 'string') message = j.message;
    else if (Array.isArray(j.message)) message = j.message.join(' ');
  } catch {
    if (raw) message = raw.slice(0, 500);
  }
  return message;
}
