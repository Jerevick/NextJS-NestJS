'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { apiBase, buildApiHeaders } from '@/lib/server-api';

export async function markNotificationReadAction(
  notificationId: string,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) {
    return { error: 'Not signed in.' };
  }

  const res = await fetch(`${apiBase}/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'PATCH',
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });

  if (!res.ok) {
    return { error: `Failed (${res.status})` };
  }

  revalidatePath('/notifications');
  return { ok: true };
}
