'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const CORE_MODULES = ['SIS', 'LMS'];
const PLANS = ['STARTER', 'GROWTH', 'ENTERPRISE'];

type ProvisionState = { error?: string } | null;

function optionalString(value: FormDataEntryValue | null): string | undefined {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || undefined;
}

function optionalNumber(value: FormDataEntryValue | null): number | undefined {
  const text = optionalString(value);
  if (!text) {
    return undefined;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function errorMessageFromBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return null;
  }
  const message = (body as { message?: unknown }).message;
  if (Array.isArray(message)) {
    return message.join(', ');
  }
  return typeof message === 'string' ? message : null;
}

export async function provisionInstitutionAction(
  _prev: ProvisionState,
  formData: FormData,
): Promise<ProvisionState> {
  const session = await auth();
  if (!session?.accessToken) {
    return { error: 'Not authenticated. Sign in again before provisioning.' };
  }
  if (!session.user?.permissions?.includes('*')) {
    return { error: 'Platform super administrator access required.' };
  }

  const name = optionalString(formData.get('name')) ?? '';
  const adminEmail = optionalString(formData.get('adminEmail')) ?? '';
  const plan = optionalString(formData.get('plan')) ?? 'STARTER';
  const requestId = optionalString(formData.get('registrationRequestId'));
  const modules = formData
    .getAll('modules')
    .map((value) => (typeof value === 'string' ? value : ''))
    .filter((value) => CORE_MODULES.includes(value));

  if (name.length < 2 || !adminEmail) {
    return { error: 'Institution name and admin email are required.' };
  }
  if (!PLANS.includes(plan)) {
    return { error: 'Choose a valid plan.' };
  }
  if (modules.length === 0) {
    return { error: 'Select SIS, LMS, or both.' };
  }

  const body: Record<string, unknown> = {
    name,
    adminEmail,
    plan,
    modules: modules.map((module) => ({ module, enabled: true })),
  };

  const optionalFields: Array<[string, unknown]> = [
    ['domain', optionalString(formData.get('domain'))],
    ['maxStudents', optionalNumber(formData.get('maxStudents'))],
    ['billingDayOfMonth', optionalNumber(formData.get('billingDayOfMonth'))],
    ['disputeWindowDays', optionalNumber(formData.get('disputeWindowDays'))],
    ['subscriptionAmount', optionalString(formData.get('subscriptionAmount'))],
    ['adminFirstName', optionalString(formData.get('adminFirstName'))],
    ['adminLastName', optionalString(formData.get('adminLastName'))],
  ];
  for (const [key, value] of optionalFields) {
    if (value !== undefined) {
      body[key] = value;
    }
  }
  if (requestId) {
    body.registrationRequestId = requestId;
    body.settings = { provisionedFromRegistrationRequestId: requestId };
  }

  let res: Response;
  try {
    res = await fetch(`${apiBase}/super-admin/institutions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return { error: 'Could not reach the platform API. Please try again.' };
  }

  if (!res.ok) {
    let message = `Provisioning failed (HTTP ${res.status}).`;
    try {
      message = errorMessageFromBody(await res.json()) ?? message;
    } catch {
      /* ignore non-json bodies */
    }
    return { error: message };
  }

  const result = (await res.json()) as { institutionId?: string; slug?: string };

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/admin');
  revalidatePath('/dashboard/admin/registration-requests');
  if (requestId) {
    revalidatePath(`/dashboard/admin/registration-requests/${requestId}`);
  }

  const success = new URLSearchParams();
  if (result.institutionId) success.set('institutionId', result.institutionId);
  if (result.slug) success.set('slug', result.slug);
  if (requestId) success.set('requestId', requestId);
  redirect(`/dashboard/admin/institutions/new?${success.toString()}`);
}
