'use server';

import { auth } from '@/auth';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Touch **`LmsStudentProgress.lastAccessedAt`** for the signed-in ACTIVE student enrolled in this course. */
export async function pingLmsCourseAccess(
  courseInstanceId: string,
): Promise<{ ok: boolean; touched?: boolean }> {
  const session = await auth();
  const token = session?.accessToken;
  if (!token || !session.user?.studentId) {
    return { ok: true };
  }

  const res = await fetch(
    `${apiBase}/lms/course-instances/${encodeURIComponent(courseInstanceId)}/student/ping`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    },
  );

  if (!res.ok) {
    return { ok: false };
  }

  try {
    return ((await res.json()) as { ok: boolean; touched?: boolean }) ?? { ok: true };
  } catch {
    return { ok: true };
  }
}
