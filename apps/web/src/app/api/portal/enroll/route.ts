import { auth } from '@/auth';
import { portalHeaders } from '@/lib/portal-api';
import { NextResponse } from 'next/server';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.accessToken || session.user.role !== 'STUDENT' || !session.user.studentId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as { studentId?: string; sectionId?: string };
  if (!body.sectionId?.trim()) {
    return NextResponse.json({ error: 'sectionId is required' }, { status: 400 });
  }
  if (body.studentId !== session.user.studentId) {
    return NextResponse.json({ error: 'Invalid student' }, { status: 403 });
  }

  const res = await fetch(`${apiBase}/portal/student/enrollments`, {
    method: 'POST',
    headers: { ...portalHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: session.user.studentId, sectionId: body.sectionId.trim() }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: text || `Enrollment failed (${res.status})` },
      { status: res.status },
    );
  }

  return NextResponse.json({ ok: true });
}
