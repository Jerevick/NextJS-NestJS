'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { apiBase, buildApiHeaders } from '@/lib/server-api';

export async function createAlumniEventAction(input: {
  title: string;
  startDate: string;
  description?: string;
  fee?: number;
}) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/alumni/events`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Failed (${res.status}): ${await res.text()}` };
  revalidatePath('/alumni');
  return { ok: true };
}

export async function registerAlumniEventAction(eventId: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/alumni/events/${encodeURIComponent(eventId)}/register`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Failed (${res.status}): ${await res.text()}` };
  revalidatePath('/alumni');
  const data = await res.json();
  return { ok: true, data };
}

export async function suggestMentorshipAction(studentId: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' as const };
  const url = `${apiBase}/alumni/mentorship/suggest-matches?studentId=${encodeURIComponent(studentId)}&includeNarrative=true`;
  const res = await fetch(url, {
    method: 'POST',
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Failed (${res.status})` as const };
  return { data: await res.json() };
}

export async function sendNewsletterAction(input: {
  subject: string;
  htmlBody: string;
  chapter?: string;
  graduationYear?: number;
}) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/alumni/newsletters/send`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Failed (${res.status}): ${await res.text()}` };
  return { ok: true, data: await res.json() };
}
