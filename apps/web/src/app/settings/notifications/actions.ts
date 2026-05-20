'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { apiBase, buildApiHeaders } from '@/lib/server-api';

export async function upsertNotificationTemplate(input: {
  event: string;
  subject?: string;
  textBody?: string;
  htmlBody?: string;
  entityId?: string;
}) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };

  const res = await fetch(`${apiBase}/notifications/admin/templates`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: input.event,
      entityId: input.entityId,
      subject: input.subject,
      textBody: input.textBody,
      htmlBody: input.htmlBody,
      channels: { email: true, inApp: true },
    }),
    cache: 'no-store',
  });

  if (!res.ok) return { error: `Save failed (${res.status}): ${await res.text()}` };
  revalidatePath('/settings/notifications');
  return { ok: true as const };
}
