'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/permissions';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type GraduationClearanceFormState = {
  error?: string;
  success?: string;
};

export async function requestGraduationClearance(
  _prev: GraduationClearanceFormState,
  formData: FormData,
): Promise<GraduationClearanceFormState> {
  const session = await auth();
  const token = session?.accessToken;
  if (!token || !hasPermission(session.user?.permissions, 'students.write')) {
    return { error: 'Not authorized.' };
  }

  const studentId = String(formData.get('studentId') ?? '').trim();
  const justification = String(formData.get('justification') ?? '').trim();

  const res = await fetch(`${apiBase}/graduation-clearance`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId,
      ...(justification ? { justification } : {}),
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    return { error: parseMessage(raw, res.status) };
  }

  revalidatePath(`/students/${studentId}`);
  return { success: 'Graduation clearance workflow started.' };
}

function parseMessage(raw: string, status: number): string {
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
