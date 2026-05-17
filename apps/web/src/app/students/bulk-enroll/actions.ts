'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/permissions';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type BulkEnrollLine = { studentId: string; ok: boolean; detail?: string };

export type BulkEnrollState = {
  error?: string;
  summary?: string;
  lines?: BulkEnrollLine[];
  jobId?: string;
  jobStatus?: string;
};

function parseStudentIds(raw: string): string[] {
  const parts = raw
    .split(/[\n,;\t]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(parts)].filter((id) => id.length >= 20 && id.length <= 36);
}

async function pollJob(
  token: string,
  jobId: string,
  maxAttempts = 60,
): Promise<{
  status: string;
  results: BulkEnrollLine[];
  successCount: number;
  failCount: number;
}> {
  for (let i = 0; i < maxAttempts; i += 1) {
    const res = await fetch(`${apiBase}/enrollments/bulk/${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`Job poll failed (${res.status})`);
    }
    const job = (await res.json()) as {
      status: string;
      results: BulkEnrollLine[];
      successCount: number;
      failCount: number;
    };
    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
      return job;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Bulk enrollment job timed out');
}

export async function bulkEnrollStudents(
  _prevState: BulkEnrollState,
  formData: FormData,
): Promise<BulkEnrollState> {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) {
    return { error: 'Not signed in.' };
  }
  if (!hasPermission(session.user?.permissions, 'enrollments.write')) {
    return { error: 'Missing enrollments.write permission.' };
  }

  const sectionId = String(formData.get('sectionId') ?? '').trim();
  const rawIds = String(formData.get('studentIds') ?? '');
  const waitlistIfFull = formData.get('waitlistIfFull') === 'on';
  const allowInterEntity = formData.get('allowInterEntity') === 'on';
  const studentIds = parseStudentIds(rawIds);

  if (!sectionId) {
    return { error: 'Section is required.' };
  }
  if (studentIds.length === 0) {
    return {
      error:
        'Paste at least one student id (one per line or comma-separated). Ids come from roster export or the profile URL.',
    };
  }
  if (studentIds.length > 500) {
    return { error: 'Maximum 500 student ids per job.' };
  }

  const res = await fetch(`${apiBase}/enrollments/bulk`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sectionId, studentIds, waitlistIfFull, allowInterEntity }),
  });

  const raw = await res.text();
  if (!res.ok) {
    return { error: parseApiMessage(raw, res.status) };
  }

  const created = JSON.parse(raw) as { id: string; status: string };
  let lines: BulkEnrollLine[] = [];
  let successCount = 0;
  let failCount = 0;
  let status = created.status;

  if (status === 'QUEUED' || status === 'RUNNING') {
    const finished = await pollJob(token, created.id);
    status = finished.status;
    lines = finished.results;
    successCount = finished.successCount;
    failCount = finished.failCount;
  } else {
    const job = JSON.parse(raw) as {
      results: BulkEnrollLine[];
      successCount: number;
      failCount: number;
    };
    lines = job.results;
    successCount = job.successCount;
    failCount = job.failCount;
  }

  revalidatePath('/students');

  return {
    jobId: created.id,
    jobStatus: status,
    summary: `Job ${created.id}: ${successCount} succeeded, ${failCount} failed (of ${lines.length}).`,
    lines,
  };
}

function parseApiMessage(raw: string, status: number): string {
  try {
    const j = JSON.parse(raw) as { message?: string | string[] };
    if (typeof j.message === 'string') {
      return j.message;
    }
    if (Array.isArray(j.message)) {
      return j.message.join(' ');
    }
  } catch {
    if (raw) {
      return raw.slice(0, 300);
    }
  }
  return `Request failed (${status}).`;
}
