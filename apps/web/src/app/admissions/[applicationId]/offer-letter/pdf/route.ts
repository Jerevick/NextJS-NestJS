import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { apiBase, buildApiHeaders } from '@/lib/server-api';

export async function GET(_: Request, ctx: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await ctx.params;
  const session = await auth();
  if (!session?.accessToken) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const res = await fetch(
    `${apiBase}/admissions/applications/${encodeURIComponent(applicationId)}/offer-letter/pdf`,
    {
      headers: buildApiHeaders(session),
      cache: 'no-store',
    },
  );
  const buf = Buffer.from(await res.arrayBuffer());
  const disposition =
    res.headers.get('Content-Disposition') ??
    `attachment; filename="offer-letter-${applicationId}.pdf"`;
  return new NextResponse(buf, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/pdf',
      'Content-Disposition': disposition,
    },
  });
}
