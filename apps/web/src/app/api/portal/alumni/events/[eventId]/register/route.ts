import { auth } from '@/auth';
import { portalHeaders } from '@/lib/portal-api';
import { NextResponse } from 'next/server';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const session = await auth();
  if (!session?.accessToken || session.user.role !== 'ALUMNI') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const body = await req.json().catch(() => ({}));

  const res = await fetch(`${apiBase}/portal/alumni/events/${eventId}/register`, {
    method: 'POST',
    headers: { ...portalHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: text || `Request failed (${res.status})` },
      { status: res.status },
    );
  }

  return NextResponse.json(await res.json());
}
