'use server';

import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function headers(session: NonNullable<Awaited<ReturnType<typeof auth>>>) {
  const h: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken ?? ''}`,
    'Content-Type': 'application/json',
  };
  if (session.user?.institutionId) {
    h['X-Institution-ID'] = session.user.institutionId;
  }
  appendOptionalEntityHeader(h, session.user);
  return h;
}

export async function summarizeLessonAction(lessonId: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/ai/content/summarize-lesson`, {
    method: 'POST',
    headers: headers(session),
    body: JSON.stringify({ lessonId }),
  });
  const raw = await res.text();
  if (!res.ok) return { error: raw.slice(0, 400) };
  return { data: JSON.parse(raw) as { summary: string; keyPoints?: string[] } };
}

export async function generateQuizAction(
  lessonId: string,
  count: number,
  difficulty: 'easy' | 'medium' | 'hard',
) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/ai/content/generate-quiz`, {
    method: 'POST',
    headers: headers(session),
    body: JSON.stringify({ lessonId, count, difficulty }),
  });
  const raw = await res.text();
  if (!res.ok) return { error: raw.slice(0, 400) };
  return { data: JSON.parse(raw) as unknown };
}

export async function generateRubricAction(assignmentDescription: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/ai/content/generate-rubric`, {
    method: 'POST',
    headers: headers(session),
    body: JSON.stringify({ assignmentDescription }),
  });
  const raw = await res.text();
  if (!res.ok) return { error: raw.slice(0, 400) };
  return { data: JSON.parse(raw) as { rubric: string } };
}

export async function essayFeedbackAction(submissionId: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/ai/essay/feedback`, {
    method: 'POST',
    headers: headers(session),
    body: JSON.stringify({ submissionId, draftOnly: true }),
  });
  const raw = await res.text();
  if (!res.ok) return { error: raw.slice(0, 400) };
  return { data: JSON.parse(raw) as { feedback: string } };
}
