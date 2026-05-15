'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/permissions';

const apiBase = process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type EnrollSectionState = {
  error?: string;
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
  if (!studentId || !sectionId) {
    return { error: 'Choose a section to enroll.' };
  }

  const res = await fetch(`${apiBase}/enrollments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ studentId, sectionId }),
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

  revalidatePath('/students');
  revalidatePath(`/students/${studentId}`);
  redirect(`/students/${studentId}`);
}
