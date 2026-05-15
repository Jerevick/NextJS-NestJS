'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { hasPermission } from '@/lib/permissions';

const apiBase = process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type ReactivationActionState = { ok?: string; error?: string };

async function headersForApi(): Promise<{ headers: Record<string, string>; error?: string }> {
  const session = await auth();
  const token = session?.accessToken;
  const institutionId = session?.user?.institutionId;
  if (!token || !institutionId) {
    return { headers: {}, error: 'You are not signed in.' };
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Institution-ID': institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);
  return { headers };
}

export async function createReactivationRequestAction(
  _prev: ReactivationActionState,
  formData: FormData,
): Promise<ReactivationActionState> {
  const { headers, error } = await headersForApi();
  if (error) {
    return { error };
  }
  const session = await auth();
  if (!hasPermission(session?.user?.permissions, 'students.write')) {
    return { error: 'You need students.write.' };
  }
  const studentId = String(formData.get('studentId') ?? '').trim();
  const justification = String(formData.get('justification') ?? '').trim();
  if (!studentId) {
    return { error: 'Student id is required.' };
  }
  if (justification.length < 10) {
    return { error: 'Justification must be at least 10 characters.' };
  }
  const res = await fetch(`${apiBase}/reactivation-requests`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ studentId, justification }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { error: t || `Request failed (${res.status})` };
  }
  revalidatePath('/students/reactivation');
  return { ok: 'Reactivation request submitted.' };
}

export async function approveReactivationRequestAction(
  _prev: ReactivationActionState,
  formData: FormData,
): Promise<ReactivationActionState> {
  const { headers, error } = await headersForApi();
  if (error) {
    return { error };
  }
  const session = await auth();
  if (!hasPermission(session?.user?.permissions, 'students.reactivate')) {
    return { error: 'You need students.reactivate (or platform super admin).' };
  }
  const id = String(formData.get('requestId') ?? '').trim();
  const reviewNotes = String(formData.get('reviewNotes') ?? '').trim();
  if (!id) {
    return { error: 'Request id is required.' };
  }
  const res = await fetch(`${apiBase}/reactivation-requests/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    headers,
    body: JSON.stringify(reviewNotes ? { reviewNotes } : {}),
  });
  if (!res.ok) {
    const t = await res.text();
    return { error: t || `Request failed (${res.status})` };
  }
  revalidatePath('/students/reactivation');
  revalidatePath(`/students/reactivation/${encodeURIComponent(id)}`);
  revalidatePath('/students');
  return { ok: 'Request approved; student set to ACTIVE.' };
}

export async function rejectReactivationRequestAction(
  _prev: ReactivationActionState,
  formData: FormData,
): Promise<ReactivationActionState> {
  const { headers, error } = await headersForApi();
  if (error) {
    return { error };
  }
  const session = await auth();
  if (!hasPermission(session?.user?.permissions, 'students.reactivate')) {
    return { error: 'You need students.reactivate (or platform super admin).' };
  }
  const id = String(formData.get('requestId') ?? '').trim();
  const reviewNotes = String(formData.get('reviewNotes') ?? '').trim();
  if (!id) {
    return { error: 'Request id is required.' };
  }
  const res = await fetch(`${apiBase}/reactivation-requests/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    headers,
    body: JSON.stringify(reviewNotes ? { reviewNotes } : {}),
  });
  if (!res.ok) {
    const t = await res.text();
    return { error: t || `Request failed (${res.status})` };
  }
  revalidatePath('/students/reactivation');
  revalidatePath(`/students/reactivation/${encodeURIComponent(id)}`);
  return { ok: 'Request rejected.' };
}
