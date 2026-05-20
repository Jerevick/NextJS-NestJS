'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function reviewRegistrationRequest(
  id: string,
  status: 'REVIEWED' | 'DISMISSED',
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.accessToken) {
    return { ok: false, error: 'Not authenticated.' };
  }
  if (!session.user?.permissions?.includes('*')) {
    return { ok: false, error: 'Platform super administrator access required.' };
  }

  const res = await fetch(
    `${apiBase}/super-admin/registration-requests/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
      cache: 'no-store',
    },
  );

  if (!res.ok) {
    let message = 'Failed to update registration request.';
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) {
        message = body.message.join(', ');
      } else if (typeof body.message === 'string') {
        message = body.message;
      }
    } catch {
      /* ignore */
    }
    return { ok: false, error: message };
  }

  revalidatePath('/admin/registration-requests');
  revalidatePath(`/admin/registration-requests/${id}`);
  return { ok: true };
}
