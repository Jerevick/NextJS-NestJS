import { auth } from '@/auth';
import { apiBase, buildApiHeaders } from '@/lib/server-api';

export async function GET(
  _req: Request,
  context: { params: Promise<{ studentId: string; transactionId: string }> },
) {
  const { studentId, transactionId } = await context.params;
  const session = await auth();
  if (!session?.accessToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  const res = await fetch(
    `${apiBase}/finance/students/${encodeURIComponent(studentId)}/transactions/${encodeURIComponent(transactionId)}/receipt.pdf`,
    { headers: buildApiHeaders(session), cache: 'no-store' },
  );

  if (!res.ok) {
    return new Response(await res.text(), { status: res.status });
  }

  const buffer = await res.arrayBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="receipt-${transactionId}.pdf"`,
    },
  });
}
