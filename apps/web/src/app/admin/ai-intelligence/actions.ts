'use server';

import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { hasPermission } from '@/lib/permissions';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type AdminAiState = { error?: string; result?: unknown };

function headers(session: NonNullable<Awaited<ReturnType<typeof auth>>>) {
  const h: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken ?? ''}`,
    'Content-Type': 'application/json',
  };
  if (session.user?.institutionId) {
    h['X-Institution-ID'] = session.user.institutionId;
  }
  appendOptionalEntityHeader(h, session.user);
  return h;
}

function canRead(permissions: string[] | undefined) {
  return (
    hasPermission(permissions, 'institutions.read') ||
    hasPermission(permissions, 'institutions.write') ||
    hasPermission(permissions, 'billing.read')
  );
}

export async function runAdminAiAction(
  _prev: AdminAiState,
  formData: FormData,
): Promise<AdminAiState> {
  const session = await auth();
  if (!session?.accessToken || !session.user?.institutionId) {
    return { error: 'You are not signed in.' };
  }
  if (!canRead(session.user.permissions)) {
    return { error: 'Insufficient permissions for administrative AI reports.' };
  }

  const action = String(formData.get('action') ?? '');
  const entityId = String(formData.get('entityId') ?? '').trim();
  const institutionId = session.user.institutionId;

  let path: string;
  switch (action) {
    case 'narrative-institution':
      path = `/ai/analytics/narrative/${institutionId}`;
      break;
    case 'narrative-entity':
      if (!entityId) return { error: 'Select a campus entity for entity narrative.' };
      path = `/ai/analytics/narrative/${institutionId}/${entityId}`;
      break;
    case 'billing-anomaly':
      path = `/ai/analytics/billing-anomaly/${institutionId}`;
      break;
    case 'dropout-institution':
      path = `/ai/analytics/dropout/${institutionId}`;
      break;
    case 'dropout-entity':
      if (!entityId) return { error: 'Select a campus entity for entity dropout scan.' };
      path = `/ai/analytics/dropout/${institutionId}/${entityId}`;
      break;
    default:
      return { error: 'Unknown action.' };
  }

  const res = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: headers(session),
  });
  const raw = await res.text();
  if (!res.ok) {
    return { error: parseError(raw, res.status) };
  }
  try {
    return { result: JSON.parse(raw) as unknown };
  } catch {
    return { error: 'Unexpected API response.' };
  }
}

function parseError(raw: string, status: number): string {
  try {
    const j = JSON.parse(raw) as { message?: string | string[] };
    if (typeof j.message === 'string') return j.message;
    if (Array.isArray(j.message)) return j.message.join(' ');
  } catch {
    if (raw) return raw.slice(0, 400);
  }
  return `Request failed (${status}).`;
}
