'use server';

import type {
  PasswordResetConfirmValues,
  PasswordResetRequestValues,
} from '@/lib/forgot-password-schema';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) {
      return body.message.join(', ');
    }
    if (body.message) {
      return body.message;
    }
  } catch {
    /* ignore */
  }
  return 'Something went wrong. Please try again.';
}

export async function requestPasswordReset(values: PasswordResetRequestValues) {
  const res = await fetch(`${apiBase}/auth/password-reset/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
    cache: 'no-store',
  });
  if (!res.ok) {
    return { ok: false as const, error: await parseError(res) };
  }
  return { ok: true as const };
}

export async function confirmPasswordReset(token: string, values: PasswordResetConfirmValues) {
  const res = await fetch(`${apiBase}/auth/password-reset/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password: values.password }),
    cache: 'no-store',
  });
  if (!res.ok) {
    return { ok: false as const, error: await parseError(res) };
  }
  return { ok: true as const };
}
