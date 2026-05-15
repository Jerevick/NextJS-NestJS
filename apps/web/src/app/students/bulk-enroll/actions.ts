'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/permissions';

const apiBase = process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type BulkEnrollLine = { studentId: string; ok: boolean; detail?: string };

export type BulkEnrollState = {
  error?: string;
  summary?: string;
  lines?: BulkEnrollLine[];
};

function parseStudentIds(raw: string): string[] {
  const parts = raw
    .split(/[\n,;\t]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const uniq = [...new Set(parts)];
  return uniq.filter((id) => id.length >= 20 && id.length <= 36);
}

export async function bulkEnrollStudents(_prevState: BulkEnrollState, formData: FormData): Promise<BulkEnrollState> {
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
  const studentIds = parseStudentIds(rawIds);

  if (!sectionId) {
    return { error: 'Section is required.' };
  }
  if (studentIds.length === 0) {
    return { error: 'Paste at least one student id (one per line or comma-separated). Ids come from roster CSV export or the profile URL.' };
  }
  if (studentIds.length > 80) {
    return { error: 'Maximum 80 student ids per run.' };
  }

  const lines: BulkEnrollLine[] = [];
  for (const studentId of studentIds) {
    const res = await fetch(`${apiBase}/enrollments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ studentId, sectionId }),
    });
    const text = await res.text();
    if (res.ok) {
      lines.push({ studentId, ok: true });
    } else {
      let detail = `HTTP ${res.status}`;
      try {
        const j = JSON.parse(text) as { message?: string | string[] };
        if (typeof j.message === 'string') {
          detail = j.message;
        } else if (Array.isArray(j.message)) {
          detail = j.message.join(' ');
        }
      } catch {
        if (text) {
          detail = text.slice(0, 200);
        }
      }
      lines.push({ studentId, ok: false, detail });
    }
  }

  const okCount = lines.filter((l) => l.ok).length;
  revalidatePath('/students');

  return {
    summary: `Completed: ${okCount} enrolled, ${lines.length - okCount} failed (of ${lines.length}).`,
    lines,
  };
}
