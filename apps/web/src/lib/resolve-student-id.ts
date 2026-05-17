import type { Session } from 'next-auth';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Resolves the student id for LMS / student-scoped actions.
 * Students use their linked record; staff may pass an explicit override (query param).
 */
export async function resolveStudentId(
  session: Session | null,
  overrideStudentId?: string | null,
): Promise<string | undefined> {
  const explicit = overrideStudentId?.trim();
  if (explicit) {
    return explicit;
  }
  if (!session?.user) {
    return undefined;
  }
  const fromSession = (session.user as { studentId?: string }).studentId;
  if (fromSession) {
    return fromSession;
  }
  if (session.user.role !== 'STUDENT' || !session.accessToken) {
    return undefined;
  }
  const res = await fetch(`${apiBase}/auth/me`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    return undefined;
  }
  const body = (await res.json()) as { user?: { studentId?: string } };
  return body.user?.studentId;
}
