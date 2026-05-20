import { appendOptionalEntityHeader } from '@/lib/api-headers';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function portalHeaders(session: {
  accessToken: string;
  user: { institutionId: string; entityId?: string; omitEntityHeader?: boolean };
}): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);
  return headers;
}

export async function fetchPortalJson<T>(
  path: string,
  session: Parameters<typeof portalHeaders>[0],
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; body: string }> {
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      ...portalHeaders(session),
      ...(init?.headers as Record<string, string> | undefined),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    return { ok: false, status: res.status, body: await res.text() };
  }
  return { ok: true, data: (await res.json()) as T };
}
