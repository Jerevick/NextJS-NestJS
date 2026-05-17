'use server';

import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { hasPermission } from '@/lib/permissions';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type EvaluateBatchState = { error?: string; result?: unknown };

export async function runProgressionEvaluateBatch(
  _prev: EvaluateBatchState,
  formData: FormData,
): Promise<EvaluateBatchState> {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) {
    return { error: 'You are not signed in.' };
  }
  if (
    !session.user?.permissions?.length ||
    (!hasPermission(session.user.permissions, 'progression.write') &&
      !hasPermission(session.user.permissions, 'students.write'))
  ) {
    return { error: 'You need progression.write or students.write to run batch evaluation.' };
  }

  const semesterId = String(formData.get('semesterId') ?? '').trim();
  if (!semesterId) {
    return { error: 'Select a semester.' };
  }
  const dryRun = formData.has('dryRun');
  const initiateReviewWorkflows = formData.has('initiateReviewWorkflows');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (session.user.institutionId) {
    headers['X-Institution-ID'] = session.user.institutionId;
  }
  appendOptionalEntityHeader(headers, session.user);

  const res = await fetch(`${apiBase}/sis/progression/evaluate-batch`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      semesterId,
      dryRun,
      initiateReviewWorkflows: !dryRun && initiateReviewWorkflows,
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    try {
      const j = JSON.parse(raw) as { message?: string | string[] };
      if (typeof j.message === 'string') {
        message = j.message;
      } else if (Array.isArray(j.message)) {
        message = j.message.join(' ');
      }
    } catch {
      if (raw) {
        message = raw.slice(0, 500);
      }
    }
    return { error: message };
  }

  try {
    return { result: JSON.parse(raw) as unknown };
  } catch {
    return { error: 'Unexpected response from API.' };
  }
}
