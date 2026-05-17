'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { apiBase, buildApiHeaders } from '@/lib/server-api';

export type FeeStructureItemInput = {
  code: string;
  name: string;
  amount: number;
  billedAt?: string;
};

export async function createFeeStructureAction(input: {
  name: string;
  academicYearId: string;
  entityId?: string;
  isDefault?: boolean;
  items: FeeStructureItemInput[];
}): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) {
    return { error: 'Not signed in.' };
  }

  const res = await fetch(`${apiBase}/finance/fee-structures`, {
    method: 'POST',
    headers: {
      ...buildApiHeaders(session),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
    cache: 'no-store',
  });

  if (!res.ok) {
    return { error: `Create failed (${res.status}): ${await res.text()}` };
  }

  revalidatePath('/finance');
  return { ok: true };
}

export async function postStudentChargeAction(
  studentId: string,
  input: { amount: number; description: string; type?: 'CHARGE' | 'ADJUSTMENT' },
): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) {
    return { error: 'Not signed in.' };
  }

  const res = await fetch(`${apiBase}/finance/students/${encodeURIComponent(studentId)}/charges`, {
    method: 'POST',
    headers: {
      ...buildApiHeaders(session),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
    cache: 'no-store',
  });

  if (!res.ok) {
    return { error: `Charge failed (${res.status}): ${await res.text()}` };
  }

  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}

export async function postStudentPaymentAction(
  studentId: string,
  input: { amount: number; description: string; paymentMethod?: string },
): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) {
    return { error: 'Not signed in.' };
  }

  const res = await fetch(`${apiBase}/finance/students/${encodeURIComponent(studentId)}/payments`, {
    method: 'POST',
    headers: {
      ...buildApiHeaders(session),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
    cache: 'no-store',
  });

  if (!res.ok) {
    return { error: `Payment failed (${res.status}): ${await res.text()}` };
  }

  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}

export async function createScholarshipAction(input: {
  name: string;
  type: string;
  fundingSource: string;
  totalFund: number;
  applicationSchemaId?: string;
}): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };

  const res = await fetch(`${apiBase}/finance/scholarships`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Create failed (${res.status}): ${await res.text()}` };
  revalidatePath('/finance');
  return { ok: true };
}

export async function createScholarshipAwardAction(
  scholarshipId: string,
  input: { studentId: string; academicYearId: string; amount: number },
): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };

  const res = await fetch(
    `${apiBase}/finance/scholarships/${encodeURIComponent(scholarshipId)}/awards`,
    {
      method: 'POST',
      headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );
  if (!res.ok) return { error: `Award failed (${res.status}): ${await res.text()}` };
  revalidatePath('/finance');
  return { ok: true };
}

export async function disburseScholarshipAwardAction(
  awardId: string,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };

  const res = await fetch(
    `${apiBase}/finance/scholarships/awards/${encodeURIComponent(awardId)}/disburse`,
    { method: 'POST', headers: buildApiHeaders(session), cache: 'no-store' },
  );
  if (!res.ok) return { error: `Disburse failed (${res.status}): ${await res.text()}` };
  revalidatePath('/finance');
  return { ok: true };
}

export async function createPaymentPlanAction(
  studentId: string,
  input: { totalAmount: number; installments: Array<{ dueDate: string; amount: number }> },
): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };

  const res = await fetch(
    `${apiBase}/finance/students/${encodeURIComponent(studentId)}/payment-plans`,
    {
      method: 'POST',
      headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );
  if (!res.ok) return { error: `Plan failed (${res.status}): ${await res.text()}` };
  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}

export async function initiateOnlinePaymentAction(
  studentId: string,
  input: { amount: number; description: string; successUrl: string; cancelUrl: string },
): Promise<{ error?: string; paymentUrl?: string }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };

  const res = await fetch(
    `${apiBase}/finance/payments/students/${encodeURIComponent(studentId)}/initiate`,
    {
      method: 'POST',
      headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );
  if (!res.ok) return { error: `Payment init failed (${res.status}): ${await res.text()}` };
  const j = (await res.json()) as { paymentUrl?: string };
  return { paymentUrl: j.paymentUrl };
}

export async function reviewScholarshipApplicationAction(
  applicationId: string,
  input: {
    status: 'APPROVED' | 'REJECTED';
    reviewNotes?: string;
    academicYearId?: string;
    awardAmount?: number;
  },
): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };

  const res = await fetch(
    `${apiBase}/finance/scholarships/applications/${encodeURIComponent(applicationId)}/review`,
    {
      method: 'POST',
      headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );
  if (!res.ok) return { error: `Review failed (${res.status}): ${await res.text()}` };
  revalidatePath('/finance');
  return { ok: true };
}

export async function requestFeeWaiverAction(
  studentId: string,
  input: { amount: number; description: string },
): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };

  const res = await fetch(`${apiBase}/finance/students/${encodeURIComponent(studentId)}/waivers`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Waiver failed (${res.status}): ${await res.text()}` };
  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}

export async function requestFinanceRefundAction(
  studentId: string,
  input: { amount: number; description: string; gatewayReference?: string },
): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };

  const res = await fetch(`${apiBase}/finance/students/${encodeURIComponent(studentId)}/refunds`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Refund failed (${res.status}): ${await res.text()}` };
  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}

export async function submitScholarshipApplicationAction(
  scholarshipId: string,
  responses?: Record<string, unknown>,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };

  const res = await fetch(
    `${apiBase}/finance/scholarships/${encodeURIComponent(scholarshipId)}/applications`,
    {
      method: 'POST',
      headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ responses: responses ?? {} }),
      cache: 'no-store',
    },
  );
  if (!res.ok) return { error: `Application failed (${res.status}): ${await res.text()}` };
  revalidatePath('/my-finance');
  return { ok: true };
}

export async function updateFeeStructureAction(
  id: string,
  input: {
    name?: string;
    programmeIds?: string[];
    isDefault?: boolean;
    items?: Array<{ code: string; name: string; amount: number; billedAt?: string }>;
  },
): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };

  const res = await fetch(`${apiBase}/finance/fee-structures/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Update failed (${res.status}): ${await res.text()}` };
  revalidatePath('/finance');
  return { ok: true };
}

export async function deleteFeeStructureAction(
  id: string,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };

  const res = await fetch(`${apiBase}/finance/fee-structures/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Delete failed (${res.status}): ${await res.text()}` };
  revalidatePath('/finance');
  return { ok: true };
}

export async function createScholarshipFormAction(
  schema: Record<string, unknown>,
): Promise<{ error?: string; ok?: boolean; formId?: string }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };

  const res = await fetch(`${apiBase}/finance/scholarship-forms`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify({ schema }),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Create failed (${res.status}): ${await res.text()}` };
  const j = (await res.json()) as { id?: string };
  revalidatePath('/finance');
  return { ok: true, formId: j.id };
}

export async function upsertBankIntegrationAction(input: {
  provider: string;
  entityId?: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
  webhookSecret?: string;
}): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };

  const res = await fetch(`${apiBase}/finance/bank-integrations`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Save failed (${res.status}): ${await res.text()}` };
  revalidatePath('/finance');
  return { ok: true };
}

export async function createBulkChargeAction(input: {
  programId: string;
  amount: number;
  description: string;
  entityId?: string;
}): Promise<{
  error?: string;
  ok?: boolean;
  mode?: 'queued' | 'sync';
  successCount?: number;
  failCount?: number;
}> {
  const session = await auth();
  if (!session?.accessToken) {
    return { error: 'Not signed in.' };
  }

  const res = await fetch(`${apiBase}/finance/bulk-charges`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) {
    return { error: `Bulk charge failed (${res.status}): ${await res.text()}` };
  }
  const j = (await res.json()) as {
    mode?: 'queued' | 'sync';
    successCount?: number;
    failCount?: number;
  };
  revalidatePath('/finance');
  return { ok: true, ...j };
}

export async function upsertGlAccountAction(input: {
  code: string;
  name: string;
  type: string;
  normalBalance: string;
}): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };

  const res = await fetch(`${apiBase}/finance/chart-of-accounts`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Save failed (${res.status}): ${await res.text()}` };
  revalidatePath('/finance');
  return { ok: true };
}

export async function setGlAccountActiveAction(
  accountId: string,
  isActive: boolean,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };

  const res = await fetch(
    `${apiBase}/finance/chart-of-accounts/${encodeURIComponent(accountId)}/active`,
    {
      method: 'PATCH',
      headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
      cache: 'no-store',
    },
  );
  if (!res.ok) return { error: `Update failed (${res.status}): ${await res.text()}` };
  revalidatePath('/finance');
  return { ok: true };
}
