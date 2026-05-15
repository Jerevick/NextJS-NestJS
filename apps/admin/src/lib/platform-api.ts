import { env } from '@/env';

type Json = Record<string, unknown>;

export type PlatformOverviewLive = {
  totalInstitutions: number;
  totalBillableStudents: number;
  openDisputes: number;
  estimatedMrr: string;
  platformHealthScore: number;
  revenuePaidLast30Days?: string;
  anomalies?: { institutionId: string; name: string; dropPct: number }[];
};

export type InstitutionDetailLive = {
  id: string;
  slug: string;
  name: string;
  status: string;
  plan: string;
  currentStudentCount: number;
  billingDayOfMonth: number | null;
  minimumBillableCount: number | null;
  disputeWindowDays: number | null;
  health: { healthScore: number };
  entities: {
    id: string;
    code: string;
    name: string;
    type: string;
    status: string;
    activeStudentCount: number;
  }[];
  subscription: { amount: string; billingCycle: string } | null;
};

function apiBase(): string {
  return env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
}

async function platformGet(
  path: string,
): Promise<{ ok: true; data: Json } | { ok: false; status: number; text: string }> {
  const token = env.ADMIN_API_BEARER;
  if (!token) {
    return { ok: false, status: 401, text: 'missing bearer' };
  }
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    return { ok: false, status: res.status, text: await res.text() };
  }
  return { ok: true, data: (await res.json()) as Json };
}

async function platformPost(
  path: string,
  body: unknown,
): Promise<{ ok: true; data: Json } | { ok: false; status: number; text: string }> {
  const token = env.ADMIN_API_BEARER;
  if (!token) {
    return { ok: false, status: 401, text: 'missing bearer' };
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
  return { ok: true, data: (await res.json()) as Json };
}

const mockInstitutions = {
  data: [
    {
      id: 'demo-1',
      slug: 'demo-university',
      name: 'Demo University (mock)',
      plan: 'STARTER',
      status: 'ACTIVE',
      healthScore: 100,
      currentStudentCount: 0,
      userAccounts: 1,
      studentRecords: 0,
    },
  ],
  total: 1,
  nextCursor: undefined as string | undefined,
};

export async function getPlatformOverview() {
  if (!env.ADMIN_API_BEARER) {
    return {
      mode: 'mock' as const,
      totalInstitutions: 1,
      totalBillableStudents: 0,
      openDisputes: 0,
      estimatedMrr: '0',
      platformHealthScore: 100,
      anomalies: [],
    };
  }
  const live = await platformGet('/super-admin/overview');
  if (live.ok) {
    const data = live.data as unknown as PlatformOverviewLive;
    return { mode: 'live' as const, ...data };
  }
  return { mode: 'error' as const, status: live.status, message: live.text };
}

export async function getMonitoringInstitutions() {
  if (!env.ADMIN_API_BEARER) {
    return {
      mode: 'mock' as const,
      ...mockInstitutions,
      notice: 'Set ADMIN_API_BEARER to a JWT with * permission for live data.',
    };
  }
  const live = await platformGet('/super-admin/institutions?limit=100');
  if (live.ok) {
    return { mode: 'live' as const, ...live.data };
  }
  return {
    mode: 'error' as const,
    status: live.status,
    message: live.text,
    data: [] as unknown[],
    total: 0,
  };
}

export async function getSuperAdminInstitution(id: string) {
  if (!env.ADMIN_API_BEARER) {
    return { mode: 'mock' as const, id, name: 'Demo (mock)' };
  }
  const live = await platformGet(`/super-admin/institutions/${encodeURIComponent(id)}`);
  if (live.ok) {
    const data = live.data as unknown as InstitutionDetailLive;
    return { mode: 'live' as const, ...data };
  }
  return { mode: 'error' as const, status: live.status, message: live.text };
}

export async function getMonitoringInstitutionUsage(id: string) {
  if (!env.ADMIN_API_BEARER) {
    return { mode: 'mock' as const, message: 'Configure ADMIN_API_BEARER to load usage.' };
  }
  const live = await platformGet(`/monitoring/institutions/${encodeURIComponent(id)}/usage`);
  if (live.ok) {
    return { mode: 'live' as const, ...live.data };
  }
  return { mode: 'error' as const, status: live.status, message: live.text };
}

export async function getMonitoringInstitutionAudit(id: string) {
  if (!env.ADMIN_API_BEARER) {
    return { mode: 'mock' as const, data: [], total: 0, notice: 'Configure ADMIN_API_BEARER.' };
  }
  const live = await platformGet(`/monitoring/institutions/${encodeURIComponent(id)}/audit-log?limit=30`);
  if (live.ok) {
    return { mode: 'live' as const, ...live.data };
  }
  return { mode: 'error' as const, status: live.status, message: live.text, data: [], total: 0 };
}

export async function getPendingBillingDisputes() {
  if (!env.ADMIN_API_BEARER) {
    return { mode: 'mock' as const, data: [], total: 0 };
  }
  const live = await platformGet('/super-admin/billing/disputes?limit=50');
  if (live.ok) {
    return { mode: 'live' as const, ...live.data };
  }
  return { mode: 'error' as const, status: live.status, message: live.text, data: [], total: 0 };
}

export async function provisionInstitution(body: Record<string, unknown>) {
  if (!env.ADMIN_API_BEARER) {
    return { mode: 'mock' as const, ok: false, message: 'Configure ADMIN_API_BEARER.' };
  }
  const live = await platformPost('/super-admin/institutions', body);
  if (live.ok) {
    return { mode: 'live' as const, ok: true, ...live.data };
  }
  return { mode: 'error' as const, ok: false, status: live.status, message: live.text };
}
