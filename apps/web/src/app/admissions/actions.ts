'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { buildApiHeaders, apiBase } from '@/lib/server-api';

const APPLICATION_STATUSES = [
  'PENDING',
  'UNDER_REVIEW',
  'ACCEPTED',
  'REJECTED',
  'WAITLISTED',
  'WITHDRAWN',
] as const;

export async function updateApplicationStatusAction(
  applicationId: string,
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  const status = String(formData.get('status') ?? '');
  if (!APPLICATION_STATUSES.includes(status as (typeof APPLICATION_STATUSES)[number])) {
    return { error: 'Invalid status.' };
  }

  const session = await auth();
  if (!session?.accessToken) {
    return { error: 'Not signed in.' };
  }

  const res = await fetch(`${apiBase}/admissions/applications/${encodeURIComponent(applicationId)}`, {
    method: 'PATCH',
    headers: {
      ...buildApiHeaders(session),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
    cache: 'no-store',
  });

  if (!res.ok) {
    return { error: `Update failed (${res.status}): ${await res.text()}` };
  }

  revalidatePath('/admissions');
  revalidatePath(`/admissions/${applicationId}`);
  return null;
}

export type EnrollStudentState = { error?: string; ok?: string; studentId?: string };

export async function enrollStudentFromApplication(
  _prev: EnrollStudentState | null,
  formData: FormData,
): Promise<EnrollStudentState> {
  const applicationId = String(formData.get('applicationId') ?? '').trim();
  if (!applicationId) {
    return { error: 'Missing application id.' };
  }

  const session = await auth();
  if (!session?.accessToken) {
    return { error: 'Not signed in.' };
  }

  const res = await fetch(
    `${apiBase}/admissions/applications/${encodeURIComponent(applicationId)}/enroll-student`,
    {
      method: 'POST',
      headers: buildApiHeaders(session),
      cache: 'no-store',
    },
  );

  const raw = await res.text();
  if (!res.ok) {
    let message = `Enroll failed (${res.status}).`;
    try {
      const j = JSON.parse(raw) as { message?: string | string[] };
      if (typeof j.message === 'string') {
        message = j.message;
      } else if (Array.isArray(j.message)) {
        message = j.message.join(' ');
      }
    } catch {
      if (raw) {
        message = raw.slice(0, 400);
      }
    }
    return { error: message };
  }

  let studentId: string | undefined;
  try {
    const body = JSON.parse(raw) as { studentId?: string };
    studentId = body.studentId;
  } catch {
    /* ignore */
  }

  revalidatePath('/admissions');
  revalidatePath(`/admissions/${applicationId}`);
  if (studentId) {
    revalidatePath(`/students/${studentId}`);
  }
  return { ok: 'Student record created and linked to application.', studentId };
}
