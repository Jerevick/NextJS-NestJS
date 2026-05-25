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

async function platformPatch(
  path: string,
  body: unknown,
): Promise<{ ok: true; data: Json } | { ok: false; status: number; text: string }> {
  const token = env.ADMIN_API_BEARER;
  if (!token) {
    return { ok: false, status: 401, text: 'missing bearer' };
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
    if (env.NODE_ENV === 'production') {
      return {
        mode: 'error' as const,
        status: 503,
        message: 'ADMIN_API_BEARER is required in production',
      };
    }
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

export async function getMrrTrend() {
  if (!env.ADMIN_API_BEARER) {
    return { mode: 'mock' as const, months: [] as { month: string; revenue: string }[] };
  }
  const live = await platformGet('/super-admin/overview/mrr-trend');
  if (live.ok) {
    return {
      mode: 'live' as const,
      ...(live.data as { months: { month: string; revenue: string }[] }),
    };
  }
  return { mode: 'error' as const, months: [], message: live.text };
}

export async function getMapPins() {
  if (!env.ADMIN_API_BEARER) {
    return {
      mode: 'mock' as const,
      pins: [
        {
          id: 'demo',
          name: 'Demo',
          plan: 'STARTER',
          status: 'ACTIVE',
          students: 0,
          coordinates: { lat: 6.5, lng: 3.4 },
        },
      ],
    };
  }
  const live = await platformGet('/super-admin/overview/map-pins');
  if (live.ok) {
    return { mode: 'live' as const, ...(live.data as { pins: unknown[] }) };
  }
  return { mode: 'error' as const, pins: [], message: live.text };
}

export async function getActiveSessions() {
  if (!env.ADMIN_API_BEARER) {
    return {
      mode: 'mock' as const,
      totalOnline: 0,
      byInstitution: [],
      asOf: new Date().toISOString(),
    };
  }
  const live = await platformGet('/super-admin/overview/active-sessions');
  if (live.ok) {
    return { mode: 'live' as const, ...(live.data as { totalOnline: number; asOf: string }) };
  }
  return {
    mode: 'error' as const,
    totalOnline: 0,
    asOf: new Date().toISOString(),
    message: live.text,
  };
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
  const live = await platformGet(
    `/monitoring/institutions/${encodeURIComponent(id)}/audit-log?limit=30`,
  );
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

export async function getRegistrationRequests(query?: {
  status?: string;
  kind?: string;
  limit?: number;
}) {
  if (!env.ADMIN_API_BEARER) {
    return { mode: 'mock' as const, data: [], total: 0 };
  }
  const params = new URLSearchParams();
  if (query?.status) params.set('status', query.status);
  if (query?.kind) params.set('kind', query.kind);
  if (query?.limit) params.set('limit', String(query.limit));
  const qs = params.toString();
  const live = await platformGet(`/super-admin/registration-requests${qs ? `?${qs}` : ''}`);
  if (live.ok) {
    const data = Array.isArray(live.data.data) ? live.data.data : [];
    return { mode: 'live' as const, data, total: data.length };
  }
  return { mode: 'error' as const, status: live.status, message: live.text, data: [], total: 0 };
}

export async function getRegistrationRequest(id: string) {
  if (!env.ADMIN_API_BEARER) {
    return { mode: 'mock' as const, found: false as const };
  }
  const live = await platformGet(`/super-admin/registration-requests/${encodeURIComponent(id)}`);
  if (live.ok) {
    return { mode: 'live' as const, found: true as const, request: live.data };
  }
  if (live.status === 404) {
    return { mode: 'live' as const, found: false as const };
  }
  return { mode: 'error' as const, status: live.status, message: live.text };
}

export async function reviewRegistrationRequest(id: string, status: 'REVIEWED' | 'DISMISSED') {
  if (!env.ADMIN_API_BEARER) {
    return { mode: 'mock' as const, ok: false, message: 'Configure ADMIN_API_BEARER.' };
  }
  const live = await platformPatch(`/super-admin/registration-requests/${encodeURIComponent(id)}`, {
    status,
  });
  if (live.ok) {
    return { mode: 'live' as const, ok: true };
  }
  return { mode: 'error' as const, ok: false, status: live.status, message: live.text };
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
