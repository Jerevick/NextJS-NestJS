import { auth } from '@/auth';
import { apiBase, buildApiHeaders } from '@/lib/server-api';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  const qs = new URL(req.url).searchParams.toString();
  const res = await fetch(`${apiBase}/finance/reports/revenue/export.pdf${qs ? `?${qs}` : ''}`, {
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });

  if (!res.ok) {
    return new Response(await res.text(), { status: res.status });
  }

  const buffer = await res.arrayBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="revenue-report.pdf"',
    },
  });
}
