'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { hasPermission } from '@/lib/permissions';

const apiBase = process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type BillingActionState = { ok?: string; error?: string };

async function billingHeaders(): Promise<{ headers: Record<string, string>; error?: string }> {
  const session = await auth();
  const token = session?.accessToken;
  const institutionId = session?.user?.institutionId;
  if (!token || !institutionId) {
    return { headers: {}, error: 'You are not signed in.' };
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Institution-ID': institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);
  return { headers };
}

export async function runDailySnapshotsAction(
  prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  void prev;
  void formData;
  const session = await auth();
  const token = session?.accessToken;
  const institutionId = session?.user?.institutionId;
  if (!token || !institutionId) {
    return { error: 'You are not signed in.' };
  }
  if (!hasPermission(session.user?.permissions, 'billing.write')) {
    return { error: 'You need billing.write to run snapshots.' };
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Institution-ID': institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);
  const res = await fetch(`${apiBase}/billing/snapshots/run-today`, { method: 'POST', headers });
  if (!res.ok) {
    const t = await res.text();
    return { error: t || `Request failed (${res.status})` };
  }
  revalidatePath('/billing');
  return { ok: 'Today’s daily snapshots job completed (or started for all institutions if you are platform admin).' };
}

export async function computeMonthlyRollupAction(
  prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  void prev;
  const { headers, error } = await billingHeaders();
  if (error) {
    return { error };
  }
  const session = await auth();
  if (!hasPermission(session?.user?.permissions, 'billing.write')) {
    return { error: 'You need billing.write.' };
  }
  const year = Number(formData.get('year'));
  const month = Number(formData.get('month'));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { error: 'Invalid year.' };
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { error: 'Invalid month.' };
  }
  const res = await fetch(`${apiBase}/billing/monthly-summaries/compute`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ year, month }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { error: t || `Request failed (${res.status})` };
  }
  revalidatePath('/billing');
  return { ok: `Monthly rollup computed for ${year}-${String(month).padStart(2, '0')}.` };
}

export async function generateDraftInvoiceAction(
  prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  void prev;
  const { headers, error } = await billingHeaders();
  if (error) {
    return { error };
  }
  const session = await auth();
  if (!hasPermission(session?.user?.permissions, 'billing.write')) {
    return { error: 'You need billing.write.' };
  }
  const year = Number(formData.get('year'));
  const month = Number(formData.get('month'));
  const isRetroactive =
    formData.get('isRetroactive') === 'on' ||
    formData.get('isRetroactive') === 'true' ||
    formData.get('isRetroactive') === '1';
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { error: 'Invalid year.' };
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { error: 'Invalid month.' };
  }
  const res = await fetch(`${apiBase}/billing/invoices/generate-draft`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ year, month, isRetroactive }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { error: t || `Request failed (${res.status})` };
  }
  const body = (await res.json()) as { invoiceId?: string };
  revalidatePath('/billing');
  return { ok: `Draft invoice created${body.invoiceId ? ` (${body.invoiceId})` : ''}.` };
}

export async function finalizeInvoiceAction(
  prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  void prev;
  const { headers, error } = await billingHeaders();
  if (error) {
    return { error };
  }
  const session = await auth();
  if (!hasPermission(session?.user?.permissions, 'billing.write')) {
    return { error: 'You need billing.write.' };
  }
  const id = String(formData.get('invoiceId') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  if (!id) {
    return { error: 'Invoice id is required.' };
  }
  const res = await fetch(`${apiBase}/billing/invoices/${encodeURIComponent(id)}/finalize`, {
    method: 'POST',
    headers,
    body: JSON.stringify(reason ? { reason } : {}),
  });
  if (!res.ok) {
    const t = await res.text();
    return { error: t || `Request failed (${res.status})` };
  }
  revalidatePath('/billing');
  return { ok: 'Invoice finalized (issued) and locked.' };
}

export async function lockSnapshotsAction(
  prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  void prev;
  const { headers, error } = await billingHeaders();
  if (error) {
    return { error };
  }
  const session = await auth();
  if (!session?.user?.permissions?.includes('*')) {
    return { error: 'Only platform super administrators can lock snapshots.' };
  }
  const institutionId = String(formData.get('institutionId') ?? '').trim();
  const entityId = String(formData.get('entityId') ?? '').trim();
  const fromDate = String(formData.get('fromDate') ?? '').trim();
  const toDate = String(formData.get('toDate') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  if (!institutionId || !fromDate || !toDate || reason.length < 10) {
    return { error: 'institutionId, fromDate, toDate, and reason (min 10 chars) are required.' };
  }
  const res = await fetch(`${apiBase}/billing/snapshots/daily/lock`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      institutionId,
      ...(entityId ? { entityId } : {}),
      fromDate,
      toDate,
      reason,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { error: t || `Request failed (${res.status})` };
  }
  const body = (await res.json()) as { updated?: number };
  revalidatePath('/billing');
  return { ok: `Locked ${body.updated ?? 0} snapshot row(s).` };
}

export async function unlockSnapshotsAction(
  prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  void prev;
  const { headers, error } = await billingHeaders();
  if (error) {
    return { error };
  }
  const session = await auth();
  if (!session?.user?.permissions?.includes('*')) {
    return { error: 'Only platform super administrators can unlock snapshots.' };
  }
  const institutionId = String(formData.get('institutionId') ?? '').trim();
  const entityId = String(formData.get('entityId') ?? '').trim();
  const fromDate = String(formData.get('fromDate') ?? '').trim();
  const toDate = String(formData.get('toDate') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  if (!institutionId || !fromDate || !toDate || reason.length < 10) {
    return { error: 'institutionId, fromDate, toDate, and reason (min 10 chars) are required.' };
  }
  const res = await fetch(`${apiBase}/billing/snapshots/daily/unlock`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      institutionId,
      ...(entityId ? { entityId } : {}),
      fromDate,
      toDate,
      reason,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { error: t || `Request failed (${res.status})` };
  }
  const body = (await res.json()) as { updated?: number };
  revalidatePath('/billing');
  return { ok: `Unlocked ${body.updated ?? 0} snapshot row(s).` };
}

export async function initiateBillingDisputeAction(
  prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  void prev;
  const { headers, error } = await billingHeaders();
  if (error) {
    return { error };
  }
  const session = await auth();
  if (!hasPermission(session?.user?.permissions, 'billing.write')) {
    return { error: 'You need billing.write to open a dispute.' };
  }
  const invoiceId = String(formData.get('invoiceId') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const rawIds = String(formData.get('disputedStudentIds') ?? '').trim();
  const disputedStudentIds = rawIds
    ? rawIds
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  if (!invoiceId) {
    return { error: 'Invoice id is required.' };
  }
  if (reason.length < 5) {
    return { error: 'Reason must be at least 5 characters.' };
  }
  const res = await fetch(`${apiBase}/billing/invoices/${encodeURIComponent(invoiceId)}/disputes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason, disputedStudentIds }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { error: t || `Request failed (${res.status})` };
  }
  const body = (await res.json()) as { id?: string };
  revalidatePath('/billing');
  revalidatePath(`/billing/invoice/${encodeURIComponent(invoiceId)}`);
  revalidatePath('/billing/disputes');
  return { ok: `Dispute opened${body.id ? ` (${body.id})` : ''}.` };
}

export async function resolveBillingDisputeAction(
  prev: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  void prev;
  const { headers, error } = await billingHeaders();
  if (error) {
    return { error };
  }
  const session = await auth();
  if (!hasPermission(session?.user?.permissions, 'billing.disputes.resolve')) {
    return { error: 'You need billing.disputes.resolve (or platform super admin) to resolve disputes.' };
  }
  const id = String(formData.get('disputeId') ?? '').trim();
  const resolution = String(formData.get('resolution') ?? '').trim().toUpperCase();
  const notes = String(formData.get('notes') ?? '').trim();
  if (!id) {
    return { error: 'Dispute id is required.' };
  }
  if (resolution !== 'ACCEPT' && resolution !== 'REJECT') {
    return { error: 'Resolution must be ACCEPT or REJECT.' };
  }
  const res = await fetch(`${apiBase}/billing/disputes/${encodeURIComponent(id)}/resolve`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ resolution, ...(notes ? { notes } : {}) }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { error: t || `Request failed (${res.status})` };
  }
  revalidatePath('/billing/disputes');
  revalidatePath(`/billing/disputes/${encodeURIComponent(id)}`);
  return { ok: 'Dispute resolved.' };
}
