'use server';

import type { NewInstitutionValues } from '@/lib/register-schema';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type RegistrationTrackingStatus = {
  reference: string;
  kind: 'JOIN_INSTITUTION' | 'NEW_INSTITUTION';
  status: 'PENDING' | 'REVIEWED' | 'PROVISIONED' | 'DISMISSED';
  submittedAt: string;
  reviewedAt: string | null;
  canUpdate?: boolean;
  institutionName: string | null;
};

export type EditableRegistrationRequest = {
  reference: string;
  status: 'PENDING' | 'REVIEWED';
  submittedAt: string;
  reviewedAt: string | null;
  values: NewInstitutionValues;
  documents: {
    hasLogo: boolean;
    logoFileName: string | null;
    hasAccreditationEvidence: boolean;
    accreditationEvidenceFileName: string | null;
  };
};

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

function buildInstitutionRegistrationFormData(
  values: NewInstitutionValues,
  logo?: File | null,
  accreditationEvidence?: File | null,
  verificationEmail?: string,
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
  if (verificationEmail) {
    form.append('verificationEmail', verificationEmail);
  }
  if (logo) {
    form.append('logo', logo);
  }
  if (accreditationEvidence) {
    form.append('accreditationEvidence', accreditationEvidence);
  }

  return form;
}

export async function submitInstitutionRequest(
  values: NewInstitutionValues,
  logo: File,
  accreditationEvidence?: File | null,
) {
  const form = buildInstitutionRegistrationFormData(values, logo, accreditationEvidence);

  let res: Response;
  try {
    res = await fetch(`${apiBase}/auth/register/institution`, {
      method: 'POST',
      body: form,
      cache: 'no-store',
    });
  } catch {
    return {
      ok: false as const,
      error:
        'Registration service is unavailable. Please make sure the UniCore API is running and try again.',
    };
  }
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

export async function loadRegistrationRequestForUpdate(reference: string, email: string) {
  const trimmed = reference.trim();
  const verificationEmail = email.trim();
  if (!trimmed) {
    return { ok: false as const, error: 'Enter a tracking reference.' };
  }
  if (!verificationEmail) {
    return { ok: false as const, error: 'Enter the contact or institutional email.' };
  }

  let res: Response;
  try {
    res = await fetch(
      `${apiBase}/auth/register/institution/${encodeURIComponent(trimmed)}/details`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail }),
        cache: 'no-store',
      },
    );
  } catch {
    return {
      ok: false as const,
      error:
        'Registration update service is unavailable. Please make sure the UniCore API is running and try again.',
    };
  }

  if (!res.ok) {
    return { ok: false as const, error: await parseError(res) };
  }

  try {
    const data = (await res.json()) as EditableRegistrationRequest;
    return { ok: true as const, data };
  } catch {
    return { ok: false as const, error: 'Registration update response was invalid.' };
  }
}

export async function updateInstitutionRequest(
  reference: string,
  verificationEmail: string,
  values: NewInstitutionValues,
  logo?: File | null,
  accreditationEvidence?: File | null,
) {
  const trimmed = reference.trim();
  if (!trimmed) {
    return { ok: false as const, error: 'Enter a tracking reference.' };
  }
  const form = buildInstitutionRegistrationFormData(
    values,
    logo,
    accreditationEvidence,
    verificationEmail,
  );

  let res: Response;
  try {
    res = await fetch(`${apiBase}/auth/register/institution/${encodeURIComponent(trimmed)}`, {
      method: 'PATCH',
      body: form,
      cache: 'no-store',
    });
  } catch {
    return {
      ok: false as const,
      error:
        'Registration update service is unavailable. Please make sure the UniCore API is running and try again.',
    };
  }

  if (!res.ok) {
    return { ok: false as const, error: await parseError(res) };
  }

  let requestId = trimmed;
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

export async function checkRegistrationRequestStatus(reference: string) {
  const trimmed = reference.trim();
  if (!trimmed) {
    return { ok: false as const, error: 'Enter a tracking reference.' };
  }

  let res: Response;
  try {
    res = await fetch(
      `${apiBase}/auth/register/institution/${encodeURIComponent(trimmed)}/status`,
      {
        method: 'GET',
        cache: 'no-store',
      },
    );
  } catch {
    return {
      ok: false as const,
      error:
        'Registration tracker is unavailable. Please make sure the UniCore API is running and try again.',
    };
  }

  if (!res.ok) {
    return { ok: false as const, error: await parseError(res) };
  }

  try {
    const data = (await res.json()) as RegistrationTrackingStatus;
    return { ok: true as const, data };
  } catch {
    return { ok: false as const, error: 'Tracker response was invalid. Please try again.' };
  }
}
