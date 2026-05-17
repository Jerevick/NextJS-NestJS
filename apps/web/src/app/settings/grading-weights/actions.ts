'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { apiBase, buildApiHeaders } from '@/lib/server-api';

export type GradingBandInput = {
  key: string;
  label: string;
  weight: number;
};

export async function saveGradingComponentWeights(
  rows: GradingBandInput[],
): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) {
    return { error: 'Not signed in.' };
  }

  const res = await fetch(`${apiBase}/grades/settings/component-weights`, {
    method: 'PATCH',
    headers: {
      ...buildApiHeaders(session),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ componentWeights: rows }),
    cache: 'no-store',
  });

  if (!res.ok) {
    return { error: `Save failed (${res.status}): ${await res.text()}` };
  }

  revalidatePath('/settings/grading-weights');
  revalidatePath('/grades/entry');
  return { ok: true };
}
