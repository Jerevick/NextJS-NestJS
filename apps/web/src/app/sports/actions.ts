'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { apiBase, buildApiHeaders } from '@/lib/server-api';

export async function createTeamAction(input: {
  name: string;
  sportTypeId: string;
  entityId?: string;
}) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/sports/teams`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Failed (${res.status}): ${await res.text()}` };
  revalidatePath('/sports');
  return { ok: true };
}

export async function fetchAtRiskAction() {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' as const };
  const res = await fetch(`${apiBase}/sports/eligibility/at-risk?includeNarrative=true`, {
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Failed (${res.status})` as const };
  return { data: await res.json() };
}

export async function createBookingAction(input: {
  facilityId: string;
  purpose: string;
  startTime: string;
  endTime: string;
}) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/sports/bookings`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Failed (${res.status}): ${await res.text()}` };
  revalidatePath('/sports');
  return { ok: true };
}
