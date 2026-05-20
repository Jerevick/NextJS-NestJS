'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { apiBase, buildApiHeaders } from '@/lib/server-api';

export async function saveAcademicSettings(patch: Record<string, unknown>, entityId?: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };

  const url = entityId
    ? `${apiBase}/customization/settings/entity/${encodeURIComponent(entityId)}`
    : `${apiBase}/customization/settings/institution`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({ patch }),
    cache: 'no-store',
  });

  if (!res.ok) return { error: `Save failed (${res.status}): ${await res.text()}` };
  revalidatePath('/settings/academic');
  return { ok: true as const };
}
