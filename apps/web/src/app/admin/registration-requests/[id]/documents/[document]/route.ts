import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; document: string }> },
) {
  const session = await auth();
  if (!session?.accessToken || !session.user.permissions?.includes('*')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, document } = await params;
  if (document !== 'logo' && document !== 'accreditationEvidence') {
    return NextResponse.json({ error: 'Unknown document' }, { status: 400 });
  }

  const res = await fetch(
    `${apiBase}/super-admin/registration-requests/${encodeURIComponent(id)}/documents/${document}`,
    {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: 'no-store',
    },
  );

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: text || `Document download failed (${res.status})` },
      { status: res.status },
    );
  }

  const headers = new Headers();
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
  const disposition = res.headers.get('content-disposition');
  headers.set('content-type', contentType);
  headers.set('cache-control', 'private, max-age=300');
  if (disposition) {
    headers.set('content-disposition', disposition);
  }

  return new Response(await res.arrayBuffer(), { status: 200, headers });
}
