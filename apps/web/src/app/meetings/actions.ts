'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { apiBase, buildApiHeaders } from '@/lib/server-api';

export async function createMeetingAction(input: {
  title: string;
  type: string;
  convenerPositionId: string;
  orgUnitId: string;
  scheduledAt: string;
  durationMinutes?: number;
  location?: string;
}) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/meetings`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Create failed (${res.status}): ${await res.text()}` };
  revalidatePath('/meetings');
  return { ok: true };
}

export async function fetchZoomSdkAction(meetingId: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/meetings/${encodeURIComponent(meetingId)}/zoom-sdk`, {
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Zoom SDK unavailable (${res.status})` };
  return (await res.json()) as {
    sdkKey: string;
    signature: string;
    meetingNumber: string;
    joinUrl: string;
  };
}

export async function fetchMeetingDetailAction(meetingId: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' as const };
  const res = await fetch(`${apiBase}/meetings/${encodeURIComponent(meetingId)}`, {
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Failed (${res.status})` as const };
  return { data: await res.json() };
}

export async function fetchResolutionsAction(q?: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' as const, data: [] };
  const url = new URL(`${apiBase}/meetings/resolutions/register`);
  if (q?.trim()) url.searchParams.set('q', q.trim());
  const res = await fetch(url.toString(), {
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Search failed (${res.status})` as const, data: [] };
  return { data: ((await res.json()) as { data?: unknown[] }).data ?? [] };
}

export async function fetchCommitteesAction() {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' as const, data: [] };
  const res = await fetch(`${apiBase}/meetings/committees`, {
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Failed (${res.status})` as const, data: [] };
  return { data: ((await res.json()) as { data?: unknown[] }).data ?? [] };
}

export async function createCommitteeAction(input: {
  name: string;
  type?: 'STANDING' | 'AD_HOC';
  orgUnitId?: string;
  memberUserIds?: string[];
}) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/meetings/committees`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Create failed (${res.status})` };
  revalidatePath('/meetings');
  return { ok: true };
}

export async function addAgendaItemAction(
  meetingId: string,
  input: { itemNumber: string; title: string; duration?: number },
) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/meetings/${encodeURIComponent(meetingId)}/agenda`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Agenda failed (${res.status})` };
  revalidatePath('/meetings');
  return { ok: true };
}

export async function updateAgendaItemAction(
  meetingId: string,
  agendaItemId: string,
  input: { itemNumber?: string; title?: string; duration?: number },
) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(
    `${apiBase}/meetings/${encodeURIComponent(meetingId)}/agenda/${encodeURIComponent(agendaItemId)}`,
    {
      method: 'PATCH',
      headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );
  if (!res.ok) return { error: `Update failed (${res.status})` };
  revalidatePath('/meetings');
  return { ok: true };
}

export async function deleteAgendaItemAction(meetingId: string, agendaItemId: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(
    `${apiBase}/meetings/${encodeURIComponent(meetingId)}/agenda/${encodeURIComponent(agendaItemId)}/delete`,
    { method: 'POST', headers: buildApiHeaders(session), cache: 'no-store' },
  );
  if (!res.ok) return { error: `Delete failed (${res.status})` };
  revalidatePath('/meetings');
  return { ok: true };
}

export async function inviteAttendeeAction(
  meetingId: string,
  input: { userId: string; isRequired?: boolean },
) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/meetings/${encodeURIComponent(meetingId)}/attendees`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Invite failed (${res.status})` };
  revalidatePath('/meetings');
  return { ok: true };
}

export async function rsvpMeetingAction(meetingId: string, status: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/meetings/${encodeURIComponent(meetingId)}/rsvp`, {
    method: 'PATCH',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `RSVP failed (${res.status})` };
  revalidatePath('/meetings');
  return { ok: true };
}

export async function markAttendanceAction(
  meetingId: string,
  input: { userId: string; attended: boolean },
) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/meetings/${encodeURIComponent(meetingId)}/attendance`, {
    method: 'PATCH',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Attendance failed (${res.status})` };
  revalidatePath('/meetings');
  return { ok: true };
}

export async function createActionItemAction(
  meetingId: string,
  input: { description: string; assignedToId?: string; dueDate?: string },
) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/meetings/${encodeURIComponent(meetingId)}/action-items`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Action item failed (${res.status})` };
  revalidatePath('/meetings');
  return { ok: true };
}

export async function updateActionItemStatusAction(actionItemId: string, status: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/meetings/action-items/${encodeURIComponent(actionItemId)}`, {
    method: 'PATCH',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Update failed (${res.status})` };
  revalidatePath('/meetings');
  return { ok: true };
}

export async function startMeetingAction(meetingId: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/meetings/${encodeURIComponent(meetingId)}/start`, {
    method: 'POST',
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Start failed (${res.status})` };
  revalidatePath('/meetings');
  return { ok: true };
}

export async function createResolutionAction(
  meetingId: string,
  input: {
    title: string;
    content: string;
    movedBy: string;
    secondedBy: string;
    votesFor?: number;
    votesAgainst?: number;
  },
) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/meetings/${encodeURIComponent(meetingId)}/resolutions`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Resolution failed (${res.status})` };
  revalidatePath('/meetings');
  return { ok: true };
}

export async function generateMinutesAction(meetingId: string, transcript: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/ai/meetings/generate-minutes`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({ meetingId, transcript }),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Generation failed (${res.status}): ${await res.text()}` };
  const body = (await res.json()) as { plainText?: string; isAIGenerated?: boolean };
  revalidatePath('/meetings');
  return { plainText: body.plainText };
}

export async function reorderAgendaAction(meetingId: string, orderedIds: string[]) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/meetings/${encodeURIComponent(meetingId)}/agenda/reorder`, {
    method: 'PATCH',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderedIds }),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Reorder failed (${res.status})` };
  revalidatePath('/meetings');
  return { ok: true };
}

export async function approveMinutesAction(meetingId: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/meetings/${encodeURIComponent(meetingId)}/minutes/approve`, {
    method: 'POST',
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Approve failed (${res.status})` };
  revalidatePath('/meetings');
  return { ok: true };
}
