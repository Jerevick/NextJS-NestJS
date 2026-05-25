'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/permissions';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type CreateStudentState = {
  error?: string;
};

export async function createStudent(
  _prevState: CreateStudentState,
  formData: FormData,
): Promise<CreateStudentState> {
  const session = await auth();
  const token = session?.accessToken;
  if (!token) {
    return { error: 'You are not signed in.' };
  }
  if (!hasPermission(session.user?.permissions, 'students.write')) {
    return { error: 'You do not have permission to create students.' };
  }

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const firstName = String(formData.get('firstName') ?? '').trim();
  const lastName = String(formData.get('lastName') ?? '').trim();
  const programId = String(formData.get('programId') ?? '').trim();
  const currentLevelRaw = String(formData.get('currentLevel') ?? '').trim();
  const admissionDate = String(formData.get('admissionDate') ?? '').trim();
  const expectedGraduationDate = String(formData.get('expectedGraduationDate') ?? '').trim();

  if (!email || !password || !firstName || !lastName || !programId) {
    return { error: 'Email, password, name, and program are required.' };
  }

  const body: Record<string, unknown> = {
    email,
    password,
    firstName,
    lastName,
    programId,
  };

  if (currentLevelRaw) {
    const n = Number(currentLevelRaw);
    if (!Number.isNaN(n) && n > 0) {
      body.currentLevel = n;
    }
  }
  if (admissionDate) {
    body.admissionDate = admissionDate;
  }
  if (expectedGraduationDate) {
    body.expectedGraduationDate = expectedGraduationDate;
  }

  const res = await fetch(`${apiBase}/students`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  if (!res.ok) {
    let message = `Could not create student (${res.status}).`;
    try {
      const j = JSON.parse(raw) as { message?: string | string[] };
      if (typeof j.message === 'string') {
        message = j.message;
      } else if (Array.isArray(j.message)) {
        message = j.message.join(' ');
      }
    } catch {
      if (raw) {
        message = raw.slice(0, 500);
      }
    }
    return { error: message };
  }

  let data: { id?: string };
  try {
    data = JSON.parse(raw) as { id?: string };
  } catch {
    return { error: 'API returned an unexpected response.' };
  }
  if (!data.id) {
    return { error: 'API returned an unexpected response.' };
  }

  revalidatePath('/dashboard/students');
  redirect(`/dashboard/students/${data.id}`);
}
