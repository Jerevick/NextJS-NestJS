'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { apiBase, buildApiHeaders } from '@/lib/server-api';

export async function requestStudentExcessRefundAction(
  studentId: string,
  input: { amount: number; description: string; gatewayReference?: string },
): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  if (session.user.studentId && session.user.studentId !== studentId) {
    return { error: 'You can only request refunds for your own account.' };
  }

  const res = await fetch(
    `${apiBase}/finance/students/${encodeURIComponent(studentId)}/excess-refunds`,
    {
      method: 'POST',
      headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );
  if (!res.ok) return { error: `Request failed (${res.status}): ${await res.text()}` };
  revalidatePath('/my-finance');
  return { ok: true };
}

export async function requestStudentExcessTransferAction(
  studentId: string,
  input: { amount: number; description: string; targetStudentNumber: string },
): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  if (session.user.studentId && session.user.studentId !== studentId) {
    return { error: 'You can only transfer from your own account.' };
  }

  const res = await fetch(
    `${apiBase}/finance/students/${encodeURIComponent(studentId)}/excess-transfers`,
    {
      method: 'POST',
      headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );
  if (!res.ok) return { error: `Request failed (${res.status}): ${await res.text()}` };
  revalidatePath('/my-finance');
  return { ok: true };
}
