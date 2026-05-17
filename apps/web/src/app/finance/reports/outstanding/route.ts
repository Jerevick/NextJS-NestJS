import { auth } from '@/auth';
import { apiBase, buildApiHeaders } from '@/lib/server-api';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  const qs = new URL(req.url).searchParams.toString();
  const res = await fetch(
    `${apiBase}/finance/reports/outstanding/export.csv${qs ? `?${qs}` : ''}`,
    {
      headers: buildApiHeaders(session),
      cache: 'no-store',
    },
  );

  if (!res.ok) {
    return new Response(await res.text(), { status: res.status });
  }

  const csv = await res.text();
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="outstanding-balances.csv"',
    },
  });
}
