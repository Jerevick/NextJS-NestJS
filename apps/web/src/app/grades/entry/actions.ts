'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { buildApiHeaders, apiBase } from '@/lib/server-api';

type GovBody = {
  componentWeights?: { key: string; weight?: number }[];
};

export async function saveEnrollmentGradeAction(
  enrollmentId: string,
  sectionId: string,
  _prev: { error?: string; ok?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; ok?: boolean } | null> {
  const workflowStatus = String(formData.get('workflowStatus') ?? 'DRAFT');

  const session = await auth();
  if (!session?.accessToken) {
    return { error: 'Not signed in.' };
  }

  const govRes = await fetch(`${apiBase}/grades/governance/effective`, {
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  const gov: GovBody = govRes.ok ? ((await govRes.json()) as GovBody) : {};
  const weights =
    gov.componentWeights?.filter(
      (w) => typeof w?.key === 'string' && w.key.length && typeof w.weight === 'number',
    ) ?? [];

  const body: Record<string, unknown> = {};

  if (weights.length > 0) {
    const components: Record<string, number> = {};
    for (const w of weights) {
      const raw = String(formData.get(`comp_${w.key}`) ?? '').trim();
      if (raw === '') {
        return { error: 'Enter a score for every weighted component (0–100).' };
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return { error: `Invalid score for "${w.key}" — use 0–100.` };
      }
      components[w.key] = n;
    }
    body.components = components;
  } else {
    const scoreRaw = String(formData.get('score') ?? '').trim();
    if (scoreRaw !== '') {
      const score = Number(scoreRaw);
      if (!Number.isFinite(score) || score < 0 || score > 100) {
        return { error: 'Score must be between 0 and 100.' };
      }
      body.score = score;
    }
  }

  if (
    workflowStatus === 'DRAFT' ||
    workflowStatus === 'SUBMITTED' ||
    workflowStatus === 'APPROVED'
  ) {
    body.workflowStatus = workflowStatus;
  }

  if (Object.keys(body).length === 0) {
    return { error: 'Nothing to save — adjust scores or workflow status.' };
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
