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
