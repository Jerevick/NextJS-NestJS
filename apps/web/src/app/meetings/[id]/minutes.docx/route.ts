import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.accessToken) {
    return new Response('Unauthorized', { status: 401 });
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);

  const res = await fetch(`${apiBase}/meetings/${encodeURIComponent(id)}/minutes.docx`, {
    headers,
    cache: 'no-store',
  });
  if (!res.ok) {
    return new Response(await res.text(), { status: res.status });
  }
  const body = await res.arrayBuffer();
  return new Response(body, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="meeting-${id}-minutes.docx"`,
    },
  });
}
