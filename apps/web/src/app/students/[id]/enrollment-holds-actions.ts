'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/permissions';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type HoldFormState = {
  error?: string;
  success?: string;
};

export async function placeEnrollmentHold(
  _prev: HoldFormState,
  formData: FormData,
): Promise<HoldFormState> {
  const session = await auth();
  const token = session?.accessToken;
  if (!token || !hasPermission(session.user?.permissions, 'enrollments.write')) {
    return { error: 'Not authorized.' };
  }

  const studentId = String(formData.get('studentId') ?? '').trim();
  const type = String(formData.get('type') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  if (!studentId || !type || reason.length < 3) {
    return { error: 'Type and reason are required.' };
  }

  const res = await fetch(`${apiBase}/students/${encodeURIComponent(studentId)}/enrollment-holds`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, reason }),
  });

  if (!res.ok) {
    const raw = await res.text();
    return { error: parseApiMessage(raw, res.status) };
  }

  revalidatePath(`/students/${studentId}`);
  return { success: `${type} hold placed.` };
}

export async function liftEnrollmentHold(
  _prev: HoldFormState,
  formData: FormData,
): Promise<HoldFormState> {
  const session = await auth();
  const token = session?.accessToken;
  if (!token || !hasPermission(session.user?.permissions, 'enrollments.write')) {
    return { error: 'Not authorized.' };
  }

  const holdId = String(formData.get('holdId') ?? '').trim();
  const studentId = String(formData.get('studentId') ?? '').trim();
  if (!holdId) {
    return { error: 'Missing hold id.' };
  }

  const res = await fetch(`${apiBase}/enrollment-holds/${encodeURIComponent(holdId)}/lift`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const raw = await res.text();
    return { error: parseApiMessage(raw, res.status) };
  }

  if (studentId) {
    revalidatePath(`/students/${studentId}`);
  }
  revalidatePath('/students');
  return { success: 'Hold lifted.' };
}

function parseApiMessage(raw: string, status: number): string {
  try {
    const j = JSON.parse(raw) as { message?: string | string[] };
    if (typeof j.message === 'string') {
      return j.message;
    }
    if (Array.isArray(j.message)) {
      return j.message.join(' ');
    }
  } catch {
    if (raw) {
      return raw.slice(0, 300);
    }
  }
  return `Request failed (${status}).`;
}
