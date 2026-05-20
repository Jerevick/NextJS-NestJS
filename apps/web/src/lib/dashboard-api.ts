import { appendOptionalEntityHeader } from '@/lib/api-headers';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function dashboardHeaders(session: {
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

export async function fetchDashboardJson<T>(
  path: string,
  session: Parameters<typeof dashboardHeaders>[0],
): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  const res = await fetch(`${apiBase}${path}`, {
    headers: dashboardHeaders(session),
    cache: 'no-store',
  });
  if (!res.ok) {
    return { ok: false, status: res.status };
  }
  return { ok: true, data: (await res.json()) as T };
}
