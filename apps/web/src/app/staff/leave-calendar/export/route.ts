import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get('from') ?? new Date().toISOString();
  const to =
    url.searchParams.get('to') ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);

  const res = await fetch(
    `${apiBase}/staff/leave-calendar/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { headers, cache: 'no-store' },
  );
  if (!res.ok) {
    return new Response(await res.text(), { status: res.status });
  }
  const body = await res.text();
  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="leave.ics"',
    },
  });
}
