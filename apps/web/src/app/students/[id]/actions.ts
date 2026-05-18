'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { hasPermission } from '@/lib/permissions';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function fetchAiAdvisorAction(studentId: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' as const };
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
    'Content-Type': 'application/json',
  };
  appendOptionalEntityHeader(headers, session.user);
  const res = await fetch(`${apiBase}/ai/advisor/${encodeURIComponent(studentId)}`, {
    method: 'POST',
    headers,
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Advisor failed (${res.status})` as const };
  const body = (await res.json()) as {
    narrative: string;
    atRisk: boolean;
    gaps?: Array<{ description: string; severity?: string }>;
    recommendations?: Array<{ courseCode?: string; title?: string; rationale: string }>;
    riskFlags?: Array<{ flag: string; detail: string }>;
  };
  return {
    narrative: body.narrative,
    atRisk: body.atRisk,
    gaps: body.gaps ?? [],
    recommendations: body.recommendations ?? [],
    riskFlags: body.riskFlags ?? [],
  };
}

export type DropEnrollmentState = { error?: string; ok?: string };

export async function dropEnrollment(
  _prevState: DropEnrollmentState,
  formData: FormData,
): Promise<DropEnrollmentState> {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) {
    return { error: 'Not signed in.' };
  }
  if (!hasPermission(session.user?.permissions, 'enrollments.write')) {
    return { error: 'Missing permission to drop enrollments.' };
  }
  const enrollmentId = String(formData.get('enrollmentId') ?? '').trim();
  const studentPath = String(formData.get('studentProfilePath') ?? '').trim();
  if (!enrollmentId) {
    return { error: 'Missing enrollment.' };
  }

  const res = await fetch(`${apiBase}/enrollments/${encodeURIComponent(enrollmentId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  const raw = await res.text();
  if (!res.ok) {
    let message = `Drop failed (${res.status}).`;
    try {
      const j = JSON.parse(raw) as { message?: string | string[] };
      if (typeof j.message === 'string') {
        message = j.message;
      } else if (Array.isArray(j.message)) {
        message = j.message.join(' ');
      }
    } catch {
      if (raw) {
        message = raw.slice(0, 400);
      }
    }
    return { error: message };
  }

  if (studentPath.startsWith('/students/')) {
    revalidatePath(studentPath);
  }
  revalidatePath('/students');
  return { ok: 'Enrollment dropped.' };
}

export type RequestDocumentState = { error?: string; ok?: string };

export async function requestStudentDocument(
  _prevState: RequestDocumentState,
  formData: FormData,
): Promise<RequestDocumentState> {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) {
    return { error: 'Not signed in.' };
  }
  if (!hasPermission(session.user?.permissions, 'documents.write')) {
    return { error: 'Missing permission to request documents.' };
  }

  const ownerId = String(formData.get('ownerId') ?? '').trim();
  const type = String(formData.get('type') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const studentPath = String(formData.get('studentProfilePath') ?? '').trim();

  if (!ownerId || !type || !title) {
    return { error: 'Type and title are required.' };
  }

  const res = await fetch(`${apiBase}/documents`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ownerId, type, title }),
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
        message = raw.slice(0, 400);
      }
    }
    return { error: message };
  }

  if (studentPath.startsWith('/students/')) {
    revalidatePath(studentPath);
  }
  return { ok: 'Document request created.' };
}

export type ConfirmGraduationState = { error?: string; ok?: string };

export async function confirmGraduation(
  _prevState: ConfirmGraduationState,
  formData: FormData,
): Promise<ConfirmGraduationState> {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) {
    return { error: 'Not signed in.' };
  }
  if (!hasPermission(session.user?.permissions, 'students.write')) {
    return { error: 'Missing students.write permission.' };
  }

  const studentId = String(formData.get('studentId') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim();
  const studentPath = String(formData.get('studentProfilePath') ?? '').trim();

  if (!studentId || reason.length < 3) {
    return { error: 'A justification of at least 3 characters is required.' };
  }

  const res = await fetch(
    `${apiBase}/students/${encodeURIComponent(studentId)}/confirm-graduation`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason, ...(notes ? { notes } : {}) }),
    },
  );

  const raw = await res.text();
  if (!res.ok) {
    let message = `Graduation confirmation failed (${res.status}).`;
    try {
      const j = JSON.parse(raw) as { message?: string | string[] };
      if (typeof j.message === 'string') {
        message = j.message;
      } else if (Array.isArray(j.message)) {
        message = j.message.join(' ');
      }
    } catch {
      if (raw) {
        message = raw.slice(0, 400);
      }
    }
    return { error: message };
  }

  if (studentPath.startsWith('/students/')) {
    revalidatePath(studentPath);
  }
  revalidatePath('/students');
  return { ok: 'Graduation confirmed. Student is now GRADUATED and no longer billable.' };
}
