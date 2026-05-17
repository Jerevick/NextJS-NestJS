'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function reorderLmsModulesAction(
  courseInstanceId: string,
  moduleIds: string[],
): Promise<{ ok: boolean; message?: string }> {
  const session = await auth();
  const token = session?.accessToken;
  if (!token?.trim()) {
    return { ok: false, message: 'Unauthorized' };
  }
  const res = await fetch(
    `${apiBase}/lms/course-instances/${encodeURIComponent(courseInstanceId.trim())}/modules/reorder`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ moduleIds }),
    },
  );

  const ok = res.ok;
  const body = ok ? '' : await res.text();
  if (ok) {
    revalidatePath(`/teach/${courseInstanceId}`);
    revalidatePath(`/courses/${courseInstanceId}`);
  }
  return ok ? { ok: true } : { ok: false, message: body.slice(0, 280) };
}

export async function reorderLmsLessonsAction(
  courseInstanceId: string,
  moduleId: string,
  lessonIds: string[],
): Promise<{ ok: boolean; message?: string }> {
  const session = await auth();
  const token = session?.accessToken;
  if (!token?.trim()) {
    return { ok: false, message: 'Unauthorized' };
  }
  const res = await fetch(
    `${apiBase}/lms/modules/${encodeURIComponent(moduleId.trim())}/lessons/reorder`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ lessonIds }),
    },
  );

  const ok = res.ok;
  const body = ok ? '' : await res.text();
  if (ok) {
    revalidatePath(`/teach/${courseInstanceId}`);
    revalidatePath(`/courses/${courseInstanceId}`);
  }
  return ok ? { ok: true } : { ok: false, message: body.slice(0, 280) };
}

export async function fetchTeachLessonDetail(
  lessonId: string,
): Promise<{ ok: boolean; lesson?: Record<string, unknown>; message?: string }> {
  const session = await auth();
  const token = session?.accessToken;
  if (!token?.trim()) {
    return { ok: false, message: 'Unauthorized' };
  }
  const res = await fetch(`${apiBase}/lms/lessons/${encodeURIComponent(lessonId.trim())}`, {
    headers: { Authorization: `Bearer ${token}`, cache: 'no-store' },
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, message: t.slice(0, 280) };
  }
  const lesson = (await res.json()) as Record<string, unknown>;
  return { ok: true, lesson };
}

export async function patchTeachLessonAction(
  courseInstanceId: string,
  lessonId: string,
  patch: Record<string, unknown>,
): Promise<{ ok: boolean; message?: string }> {
  const session = await auth();
  const token = session?.accessToken;
  if (!token?.trim()) {
    return { ok: false, message: 'Unauthorized' };
  }
  const res = await fetch(`${apiBase}/lms/lessons/${encodeURIComponent(lessonId.trim())}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, message: t.slice(0, 280) };
  }
  revalidatePath(`/teach/${courseInstanceId}`);
  revalidatePath(`/courses/${courseInstanceId}`);
  return { ok: true };
}

export async function createTeachLessonResourceAction(
  courseInstanceId: string,
  lessonId: string,
  body: { title: string; fileKey: string; fileType: string },
): Promise<{ ok: boolean; message?: string }> {
  const session = await auth();
  const token = session?.accessToken;
  if (!token?.trim()) {
    return { ok: false, message: 'Unauthorized' };
  }
  const res = await fetch(
    `${apiBase}/lms/lessons/${encodeURIComponent(lessonId.trim())}/resources`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, message: t.slice(0, 280) };
  }
  revalidatePath(`/teach/${courseInstanceId}`);
  revalidatePath(`/courses/${courseInstanceId}`);
  return { ok: true };
}

export async function gradeSubmissionFromTeachAction(
  courseInstanceId: string,
  submissionId: string,
  percentScore: number,
): Promise<{ ok: boolean; message?: string }> {
  const session = await auth();
  const token = session?.accessToken;
  if (!token?.trim()) {
    return { ok: false, message: 'Unauthorized' };
  }
  const clamped = Math.min(100, Math.max(0, percentScore));
  const res = await fetch(
    `${apiBase}/lms/submissions/${encodeURIComponent(submissionId.trim())}/grade`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ grade: { percentScore: clamped } }),
    },
  );
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, message: t.slice(0, 280) };
  }
  revalidatePath(`/teach/${courseInstanceId}`);
  return { ok: true };
}
