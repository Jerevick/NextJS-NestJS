'use server';

import type { NewInstitutionValues } from '@/lib/register-schema';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) {
      return body.message.join(', ');
    }
    if (body.message) {
      return body.message;
    }
  } catch {
    /* ignore */
  }
  return 'Something went wrong. Please try again.';
}

export async function submitInstitutionRequest(
  values: NewInstitutionValues,
  logo: File,
  accreditationEvidence?: File | null,
) {
  const form = new FormData();

  const scalarKeys: (keyof NewInstitutionValues)[] = [
    'institutionName',
    'institutionType',
    'institutionEmail',
    'addressLine1',
    'addressLine2',
    'city',
    'stateProvince',
    'postalCode',
    'country',
    'accreditationStatus',
    'accreditationBody',
    'accreditationReference',
    'accreditationValidUntil',
    'contactFirstName',
    'contactLastName',
    'contactTitle',
    'contactPhone',
    'contactEmail',
    'estimatedStudents',
    'message',
  ];

  for (const key of scalarKeys) {
    const v = values[key];
    if (v !== undefined && v !== '') {
      form.append(key, String(v));
    }
  }

  form.append('modulesInterested', JSON.stringify(values.modulesInterested));
  form.append('logo', logo);
  if (accreditationEvidence) {
    form.append('accreditationEvidence', accreditationEvidence);
  }

  const res = await fetch(`${apiBase}/auth/register/institution`, {
    method: 'POST',
    body: form,
    cache: 'no-store',
  });
  if (!res.ok) {
    return { ok: false as const, error: await parseError(res) };
  }

  let requestId: string | undefined;
  try {
    const data = (await res.json()) as { requestId?: string };
    if (typeof data.requestId === 'string') {
      requestId = data.requestId;
    }
  } catch {
    /* response body optional */
  }
  return { ok: true as const, email: values.contactEmail, requestId };
}
