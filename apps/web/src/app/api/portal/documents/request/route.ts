import { auth } from '@/auth';
import { portalHeaders } from '@/lib/portal-api';
import { NextResponse } from 'next/server';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.accessToken || session.user.role !== 'STUDENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as { type?: string; title?: string };
  if (!body.type?.trim()) {
    return NextResponse.json({ error: 'type is required' }, { status: 400 });
  }

  const res = await fetch(`${apiBase}/portal/student/documents/request`, {
    method: 'POST',
    headers: { ...portalHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: body.type.trim(), title: body.title?.trim() }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: text || `Request failed (${res.status})` },
      { status: res.status },
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
