'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { apiBase, buildApiHeaders } from '@/lib/server-api';

export async function searchUsersForStaffAction(
  q: string,
): Promise<{ error?: string; data?: Array<{ id: string; email: string; name: string }> }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/staff/users/available?q=${encodeURIComponent(q)}`, {
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Search failed (${res.status})` };
  const body = (await res.json()) as { data?: Array<{ id: string; email: string; name: string }> };
  return { data: body.data ?? [] };
}

export async function createStaffProfileAction(input: {
  userId: string;
  staffNumber: string;
  orgUnitId: string;
  positionId: string;
  salaryAmount?: number;
  salaryCurrency?: string;
  qualifications?: unknown[];
  publications?: unknown[];
}): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const body: Record<string, unknown> = {
    userId: input.userId,
    staffNumber: input.staffNumber,
    orgUnitId: input.orgUnitId,
    positionId: input.positionId,
  };
  if (input.salaryAmount != null && !Number.isNaN(input.salaryAmount)) {
    body.salary = {
      amount: input.salaryAmount,
      currency: input.salaryCurrency ?? 'USD',
    };
  }
  if (input.qualifications?.length) body.qualifications = input.qualifications;
  if (input.publications?.length) body.publications = input.publications;
  const res = await fetch(`${apiBase}/staff/profiles`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Create failed (${res.status}): ${await res.text()}` };
  revalidatePath('/staff');
  return { ok: true };
}

export async function updateStaffProfileAction(
  id: string,
  input: {
    orgUnitId?: string;
    positionId?: string;
    officeLocation?: string;
    salaryAmount?: number;
    salaryCurrency?: string;
  },
): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const body: Record<string, unknown> = {};
  if (input.orgUnitId) body.orgUnitId = input.orgUnitId;
  if (input.positionId) body.positionId = input.positionId;
  if (input.officeLocation !== undefined) body.officeLocation = input.officeLocation;
  if (input.salaryAmount != null && !Number.isNaN(input.salaryAmount)) {
    body.salary = {
      amount: input.salaryAmount,
      currency: input.salaryCurrency ?? 'USD',
    };
  }
  const res = await fetch(`${apiBase}/staff/profiles/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Update failed (${res.status}): ${await res.text()}` };
  revalidatePath('/staff');
  return { ok: true };
}

export async function deleteStaffProfileAction(
  id: string,
): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/staff/profiles/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Delete failed (${res.status}): ${await res.text()}` };
  revalidatePath('/staff');
  return { ok: true };
}

export async function createLeaveTypeAction(input: {
  name: string;
  code: string;
  annualAllocation: number;
}): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/staff/leave-types`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Create failed (${res.status}): ${await res.text()}` };
  revalidatePath('/staff');
  return { ok: true };
}

export async function allocateLeaveBalanceAction(input: {
  staffId: string;
  leaveTypeId: string;
  academicYearId: string;
  allocated: number;
  carriedOver?: number;
}): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/staff/leave-balances/allocate`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Allocate failed (${res.status}): ${await res.text()}` };
  revalidatePath('/staff');
  return { ok: true };
}

export async function carryForwardLeaveAction(input: {
  fromAcademicYearId: string;
  toAcademicYearId: string;
}): Promise<{ error?: string; ok?: boolean; carriedForward?: number }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/staff/leave-balances/carry-forward`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Carry-forward failed (${res.status}): ${await res.text()}` };
  const body = (await res.json()) as { carriedForward?: number };
  revalidatePath('/staff');
  return { ok: true, carriedForward: body.carriedForward };
}

export async function uploadLeaveSupportingDocumentAction(
  staffId: string,
  formData: FormData,
): Promise<{ error?: string; supportingDocKey?: string; downloadUrl?: string | null }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a file to upload.' };
  }
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(
    `${apiBase}/staff/leave-supporting-documents?staffId=${encodeURIComponent(staffId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'X-Institution-ID': session.user.institutionId,
        ...(session.user.entityId ? { 'X-Entity-ID': session.user.entityId } : {}),
      },
      body,
      cache: 'no-store',
    },
  );
  if (!res.ok) return { error: `Upload failed (${res.status}): ${await res.text()}` };
  return (await res.json()) as { supportingDocKey: string; downloadUrl?: string | null };
}

export async function createLeaveRequestAction(input: {
  staffId: string;
  leaveTypeId: string;
  academicYearId: string;
  startDate: string;
  endDate: string;
  reason: string;
  coveringStaffId?: string;
  supportingDocKey?: string;
}): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/staff/leave-requests`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Request failed (${res.status}): ${await res.text()}` };
  revalidatePath('/staff');
  return { ok: true };
}

export async function fetchWorkloadListAction(semesterId: string): Promise<{
  error?: string;
  data?: Array<{
    id: string;
    totalCreditHours: number;
    maxCreditHours: number;
    utilizationPct: number;
    overCapacity: boolean;
    staff: { staffNumber: string; name?: string };
  }>;
}> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(
    `${apiBase}/staff/workload?semesterId=${encodeURIComponent(semesterId)}`,
    { headers: buildApiHeaders(session), cache: 'no-store' },
  );
  if (!res.ok) return { error: `Load failed (${res.status})` };
  const body = (await res.json()) as {
    data?: Array<{
      id: string;
      totalCreditHours: number;
      maxCreditHours: number;
      utilizationPct: number;
      overCapacity: boolean;
      staff: { staffNumber: string; name?: string };
    }>;
  };
  return { data: body.data ?? [] };
}

export async function upsertWorkloadAction(input: {
  staffId: string;
  semesterId: string;
  totalCreditHours: number;
  maxCreditHours?: number;
  researchHours?: number;
  adminHours?: number;
  assignedSections?: unknown[];
}): Promise<{ error?: string; ok?: boolean; warning?: string }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/staff/workload`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Save failed (${res.status}): ${await res.text()}` };
  const body = (await res.json()) as { warning?: string };
  revalidatePath('/staff');
  return { ok: true, warning: body.warning };
}

export async function suggestWorkloadAction(
  semesterId: string,
  totalHours: number,
): Promise<{
  error?: string;
  suggestions?: Array<{ staffId: string; suggestedCreditHours: number; note: string }>;
}> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(
    `${apiBase}/staff/workload/suggest?semesterId=${encodeURIComponent(semesterId)}&totalHours=${encodeURIComponent(String(totalHours))}`,
    { headers: buildApiHeaders(session), cache: 'no-store' },
  );
  if (!res.ok) return { error: `Suggest failed (${res.status})` };
  const body = (await res.json()) as {
    suggestions?: Array<{ staffId: string; suggestedCreditHours: number; note: string }>;
  };
  return { suggestions: body.suggestions ?? [] };
}

export async function createAppraisalAction(input: {
  staffId: string;
  periodStart: string;
  periodEnd: string;
  type?: string;
  reviewerId?: string;
}): Promise<{ error?: string; ok?: boolean; id?: string }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/staff/appraisals`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Create failed (${res.status}): ${await res.text()}` };
  const row = (await res.json()) as { id?: string };
  revalidatePath('/staff');
  return { ok: true, id: row.id };
}

export async function createAppraisalCycleAction(input: {
  periodStart: string;
  periodEnd: string;
  type?: string;
  staffIds?: string[];
}): Promise<{ error?: string; ok?: boolean; created?: number }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/staff/appraisals/cycle`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Cycle failed (${res.status}): ${await res.text()}` };
  const body = (await res.json()) as { created?: number };
  revalidatePath('/staff');
  return { ok: true, created: body.created };
}

export async function addPeerFeedbackAction(
  appraisalId: string,
  input: { peerUserId: string; rating?: number; comment?: string },
): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(
    `${apiBase}/staff/appraisals/${encodeURIComponent(appraisalId)}/peer-feedback`,
    {
      method: 'POST',
      headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      cache: 'no-store',
    },
  );
  if (!res.ok) return { error: `Peer feedback failed (${res.status}): ${await res.text()}` };
  revalidatePath('/staff');
  return { ok: true };
}

export async function submitAppraisalAction(
  id: string,
  body: { selfAssessment?: string; peerFeedback?: unknown[] },
): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  if (body.selfAssessment) {
    const patch = await fetch(`${apiBase}/staff/appraisals/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selfAssessment: body.selfAssessment,
        peerFeedback: body.peerFeedback,
      }),
      cache: 'no-store',
    });
    if (!patch.ok) return { error: `Update failed (${patch.status})` };
  }
  const res = await fetch(`${apiBase}/staff/appraisals/${encodeURIComponent(id)}/submit`, {
    method: 'POST',
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Submit failed (${res.status}): ${await res.text()}` };
  revalidatePath('/staff');
  return { ok: true };
}

export async function grantTeachingEntityAccessAction(
  staffId: string,
  entityId: string,
): Promise<{
  error?: string;
  data?: { teachingEntities: Array<{ id: string; code: string; name: string }> };
}> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(
    `${apiBase}/staff/profiles/${encodeURIComponent(staffId)}/entity-access`,
    {
      method: 'POST',
      headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityId }),
      cache: 'no-store',
    },
  );
  if (!res.ok) return { error: `Grant failed (${res.status})` };
  revalidatePath('/staff');
  return { data: await res.json() };
}

export async function revokeTeachingEntityAccessAction(
  staffId: string,
  entityId: string,
): Promise<{
  error?: string;
  data?: { teachingEntities: Array<{ id: string; code: string; name: string }> };
}> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(
    `${apiBase}/staff/profiles/${encodeURIComponent(staffId)}/entity-access/${encodeURIComponent(entityId)}`,
    { method: 'DELETE', headers: buildApiHeaders(session), cache: 'no-store' },
  );
  if (!res.ok) return { error: `Revoke failed (${res.status})` };
  revalidatePath('/staff');
  return { data: await res.json() };
}

export async function applyWorkloadSuggestionsAction(input: {
  semesterId: string;
  suggestions: Array<{ staffId: string; suggestedCreditHours: number }>;
}): Promise<{
  error?: string;
  applied?: number;
  skipped?: Array<{ staffId: string; reason: string }>;
}> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/staff/workload/apply-suggestions`, {
    method: 'POST',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Apply failed (${res.status})` };
  const body = (await res.json()) as {
    applied?: number;
    skipped?: Array<{ staffId: string; reason: string }>;
  };
  revalidatePath('/staff');
  return { applied: body.applied, skipped: body.skipped };
}

export async function updateAppraisalReviewerAction(
  id: string,
  input: { reviewerComments?: string; overallRating?: number; kpiScores?: Record<string, unknown> },
): Promise<{ error?: string; ok?: boolean }> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/staff/appraisals/${encodeURIComponent(id)}/reviewer`, {
    method: 'PATCH',
    headers: { ...buildApiHeaders(session), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Reviewer update failed (${res.status})` };
  revalidatePath('/staff');
  return { ok: true };
}

export async function fetchKpiTemplateAction(positionId: string): Promise<{
  error?: string;
  template?: Array<{ key: string; label: string; weight?: number }>;
  duties?: string[];
  responsibilities?: string[];
}> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(
    `${apiBase}/staff/kpi-template?positionId=${encodeURIComponent(positionId)}`,
    { headers: buildApiHeaders(session), cache: 'no-store' },
  );
  if (!res.ok) return { error: `Template failed (${res.status})` };
  const body = (await res.json()) as {
    template?: Array<{ key: string; label: string; weight?: number }>;
    duties?: string[];
    responsibilities?: string[];
  };
  return {
    template: body.template,
    duties: body.duties,
    responsibilities: body.responsibilities,
  };
}

export async function fetchStaffRoleProfileAction(staffId: string): Promise<{
  error?: string;
  roleExpectations?: { duties: string[]; responsibilities: string[] };
  immediateHead?: { userId: string; email: string; name: string } | null;
  kpiTemplate?: Array<{ key: string; label: string; weight?: number }>;
}> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  const res = await fetch(`${apiBase}/staff/staff/${encodeURIComponent(staffId)}/role-profile`, {
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Role profile failed (${res.status})` };
  const body = (await res.json()) as {
    roleExpectations?: { duties: string[]; responsibilities: string[] };
    immediateHead?: { userId: string; email: string; name: string } | null;
    kpiTemplate?: Array<{ key: string; label: string; weight?: number }>;
  };
  return {
    roleExpectations: body.roleExpectations,
    immediateHead: body.immediateHead,
    kpiTemplate: body.kpiTemplate,
  };
}
