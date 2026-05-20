'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { apiBase, buildApiHeaders } from '@/lib/server-api';

export type FormFieldInput = {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  options?: string[];
  showWhen?: { fieldId: string; equals?: unknown };
  accept?: string;
};

export async function createCustomForm(input: {
  formType: string;
  title: string;
  description?: string;
  fields: FormFieldInput[];
}) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };

  const res = await fetch(`${apiBase}/customization/forms`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      formType: input.formType,
      title: input.title,
      description: input.description,
      schema: { title: input.title, fields: input.fields },
    }),
    cache: 'no-store',
  });

  if (!res.ok) return { error: `Create failed (${res.status}): ${await res.text()}` };
  revalidatePath('/settings/custom-forms');
  return { ok: true as const, form: await res.json() };
}

export async function publishCustomForm(formId: string) {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };

  const res = await fetch(`${apiBase}/customization/forms/${formId}`, {
    method: 'PATCH',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'PUBLISHED' }),
    cache: 'no-store',
  });

  if (!res.ok) return { error: `Publish failed (${res.status}): ${await res.text()}` };
  revalidatePath('/settings/custom-forms');
  return { ok: true as const };
}
