'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/permissions';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type EnrollSectionState = {
  error?: string;
  success?: string;
};

export async function enrollInSection(
  _prevState: EnrollSectionState,
  formData: FormData,
): Promise<EnrollSectionState> {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) {
    return { error: 'You are not signed in.' };
  }
  if (!hasPermission(session.user?.permissions, 'enrollments.write')) {
    return { error: 'You do not have permission to create enrollments.' };
  }

  const studentId = String(formData.get('studentId') ?? '').trim();
  const sectionId = String(formData.get('sectionId') ?? '').trim();
  const waitlistIfFull = formData.get('waitlistIfFull') === 'on';
  const enrollmentAttemptRaw = String(formData.get('enrollmentAttemptNumber') ?? '1').trim();
  let enrollmentAttemptNumber: number | undefined;
  const parsedAttempt = Number.parseInt(enrollmentAttemptRaw, 10);
  if (Number.isFinite(parsedAttempt) && parsedAttempt >= 1) {
    enrollmentAttemptNumber = parsedAttempt;
  }
  const originalSemesterId = String(formData.get('originalSemesterId') ?? '').trim() || undefined;
  if (!studentId || !sectionId) {
    return { error: 'Choose a section to enroll.' };
  }

  const res = await fetch(`${apiBase}/enrollments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      studentId,
      sectionId,
      waitlistIfFull,
      allowInterEntity: formData.get('allowInterEntity') === 'on',
      ...(enrollmentAttemptNumber !== undefined && enrollmentAttemptNumber !== 1
        ? { enrollmentAttemptNumber }
        : {}),
      ...(originalSemesterId ? { originalSemesterId } : {}),
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    let message = `Enrollment failed (${res.status}).`;
    try {
      const j = JSON.parse(raw) as { message?: string | string[] };
      if (typeof j.message === 'string') {
        message = j.message;
      } else if (Array.isArray(j.message)) {
        message = j.message.join(' ');
      }
    } catch {
      if (raw) {
        message = raw.slice(0, 500);
      }
    }
    return { error: message };
  }

  let payload: { status?: string; position?: number } = {};
  try {
    payload = JSON.parse(raw) as { status?: string; position?: number };
  } catch {
    payload = {};
  }

  revalidatePath('/students');
  revalidatePath(`/students/${studentId}`);

  if (payload.status === 'WAITING' && typeof payload.position === 'number') {
    return {
      success: `Section is full. Student added to waitlist (position ${payload.position}).`,
    };
  }

  redirect(`/students/${studentId}`);
}
