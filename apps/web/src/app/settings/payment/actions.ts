'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { apiBase, buildApiHeaders } from '@/lib/server-api';

export async function savePaymentSettings(input: {
  gateway: string;
  secretKey?: string;
  publicKey?: string;
  entityId?: string;
}) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };

  const scopeEntityId =
    input.entityId ?? (session.user.entityScope === 'ENTITY' ? session.user.entityId : undefined);

  const gatewayUrl = scopeEntityId
    ? `${apiBase}/customization/settings/entity/${encodeURIComponent(scopeEntityId)}`
    : `${apiBase}/customization/settings/institution`;

  const gatewayRes = await fetch(gatewayUrl, {
    method: 'PATCH',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({ patch: { paymentGateway: input.gateway } }),
    cache: 'no-store',
  });
  if (!gatewayRes.ok) {
    return { error: `Gateway save failed (${gatewayRes.status}): ${await gatewayRes.text()}` };
  }

  if (input.secretKey?.trim() || input.publicKey?.trim()) {
    if (session.user.entityScope === 'ENTITY') {
      return { error: 'API keys can only be updated at institution scope (not per campus).' };
    }
    const credRes = await fetch(`${apiBase}/customization/settings/institution`, {
      method: 'PATCH',
      headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patch: {
          'payment.credentials': {
            [input.gateway]: {
              ...(input.secretKey?.trim() ? { secretKey: input.secretKey.trim() } : {}),
              ...(input.publicKey?.trim() ? { publicKey: input.publicKey.trim() } : {}),
            },
          },
        },
      }),
      cache: 'no-store',
    });
    if (!credRes.ok) {
      return { error: `Credentials save failed (${credRes.status}): ${await credRes.text()}` };
    }
  }

  revalidatePath('/settings/payment');
  return { ok: true as const };
}
