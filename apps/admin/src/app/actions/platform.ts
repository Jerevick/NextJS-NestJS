'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { env } from '@/env';

function apiBase(): string {
  return env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
}

async function platformPatch(
  path: string,
  body: unknown,
): Promise<
  { ok: true; data: Record<string, unknown> } | { ok: false; status: number; text: string }
> {
  const token = env.ADMIN_API_BEARER;
  if (!token) {
    return { ok: false, status: 401, text: 'ADMIN_API_BEARER is not configured' };
  }
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    return { ok: false, status: res.status, text: await res.text() };
  }
  return { ok: true, data: (await res.json()) as Record<string, unknown> };
}

async function platformPost(
  path: string,
  body: unknown,
): Promise<
  { ok: true; data: Record<string, unknown> } | { ok: false; status: number; text: string }
> {
  const token = env.ADMIN_API_BEARER;
  if (!token) {
    return { ok: false, status: 401, text: 'ADMIN_API_BEARER is not configured' };
  }
  const res = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    return { ok: false, status: res.status, text: await res.text() };
  }
  return { ok: true, data: (await res.json()) as Record<string, unknown> };
}

export async function provisionInstitutionAction(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  const slug = String(formData.get('slug') ?? '')
    .trim()
    .toLowerCase();
  const name = String(formData.get('name') ?? '').trim();
  const adminEmail = String(formData.get('adminEmail') ?? '').trim();
  const adminPassword = String(formData.get('adminPassword') ?? '');
  const domain = String(formData.get('domain') ?? '').trim();
  const plan = String(formData.get('plan') ?? 'STARTER');
  const requestId = String(formData.get('registrationRequestId') ?? '').trim();
  const adminFirstName = String(formData.get('adminFirstName') ?? '').trim();
  const adminLastName = String(formData.get('adminLastName') ?? '').trim();

  if (!slug || !name || !adminEmail || adminPassword.length < 8) {
    return { error: 'Slug, name, admin email, and password (8+ chars) are required.' };
  }

  const body: Record<string, unknown> = {
    slug,
    name,
    adminEmail,
    adminPassword,
    plan,
  };
  if (domain) {
    body.domain = domain;
  }
  if (adminFirstName) {
    body.adminFirstName = adminFirstName;
  }
  if (adminLastName) {
    body.adminLastName = adminLastName;
  }

  const result = await platformPost('/super-admin/institutions', body);
  if (!result.ok) {
    return { error: `Provision failed (${result.status}): ${result.text}` };
  }

  const institutionId =
    typeof result.data.institutionId === 'string'
      ? result.data.institutionId
      : typeof result.data.id === 'string'
        ? result.data.id
        : null;

  if (requestId) {
    await platformPatch(`/super-admin/registration-requests/${encodeURIComponent(requestId)}`, {
      status: 'REVIEWED',
    });
  }

  revalidatePath('/institutions');
  revalidatePath('/dashboard');
  revalidatePath('/registration-requests');

  if (institutionId) {
    redirect(`/institutions/${institutionId}`);
  }
  redirect('/institutions');
}

export async function resolveBillingDisputeAction(
  disputeId: string,
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  const resolution = String(formData.get('resolution') ?? '');
  const notes = String(formData.get('notes') ?? '').trim();

  if (resolution !== 'ACCEPT' && resolution !== 'REJECT') {
    return { error: 'Choose ACCEPT or REJECT.' };
  }

  const body: Record<string, unknown> = { resolution };
  if (notes) {
    body.notes = notes;
  }

  const result = await platformPost(
    `/super-admin/billing/disputes/${encodeURIComponent(disputeId)}/resolve`,
    body,
  );
  if (!result.ok) {
    return { error: `Resolve failed (${result.status}): ${result.text}` };
  }

  revalidatePath('/billing');
  revalidatePath(`/billing/disputes/${disputeId}`);
  redirect('/billing');
}
