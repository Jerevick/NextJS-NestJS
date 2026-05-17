'use client';

import type { Session } from 'next-auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';

export function buildClientFetchHeaders(
  session: Session | null,
): Record<string, string> | undefined {
  if (!session?.accessToken || !session.user?.institutionId) {
    return undefined;
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);
  return headers;
}
