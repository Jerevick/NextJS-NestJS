import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import type { Session } from 'next-auth';

export const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export function buildApiHeaders(session: Session): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken ?? ''}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);
  return headers;
}

export async function getAuthenticatedSession(): Promise<Session | null> {
  const session = await auth();
  if (!session?.accessToken || !session.user?.institutionId) {
    return null;
  }
  return session;
}
