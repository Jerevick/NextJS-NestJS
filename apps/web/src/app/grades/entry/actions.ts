'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { buildApiHeaders, apiBase } from '@/lib/server-api';

export async function saveEnrollmentGradeAction(
  enrollmentId: string,
  sectionId: string,
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean } | null> {
  const scoreRaw = String(formData.get('score') ?? '').trim();
  const workflowStatus = String(formData.get('workflowStatus') ?? 'DRAFT');

  const body: Record<string, unknown> = {};
  if (scoreRaw !== '') {
    const score = Number(scoreRaw);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return { error: 'Score must be between 0 and 100.' };
    }
    body.score = score;
  }
  if (workflowStatus === 'DRAFT' || workflowStatus === 'SUBMITTED' || workflowStatus === 'APPROVED') {
    body.workflowStatus = workflowStatus;
  }

  const session = await auth();
  if (!session?.accessToken) {
    return { error: 'Not signed in.' };
  }

  const res = await fetch(`${apiBase}/grades/enrollments/${encodeURIComponent(enrollmentId)}`, {
    method: 'PATCH',
    headers: {
      ...buildApiHeaders(session),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!res.ok) {
    return { error: `Save failed (${res.status}): ${await res.text()}` };
  }

  revalidatePath('/grades/entry');
  revalidatePath(`/grades/entry?sectionId=${sectionId}`);
  return { ok: true };
}
