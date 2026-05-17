import Link from 'next/link';
import { auth } from '@/auth';
import { StaffHubPanels } from '@/components/staff/staff-hub-panels';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { hasPermission } from '@/lib/permissions';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default async function StaffPage() {
  const session = await auth();
  const canStaff =
    hasPermission(session?.user?.permissions, 'staff.read') ||
    hasPermission(session?.user?.permissions, 'staff.write');

  if (!session?.accessToken) {
    return (
      <main style={{ padding: '2rem' }}>
        <p style={{ color: '#64748b' }}>Sign in to open HR & staff tools.</p>
      </main>
    );
  }

  if (!canStaff) {
    return (
      <main style={{ padding: '2rem', maxWidth: 720 }}>
        <h1 style={{ color: '#0f1729' }}>Staff & HR</h1>
        <p style={{ color: '#64748b' }}>You need staff.read or staff.write permission.</p>
      </main>
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);

  let profiles: Array<{
    id: string;
    staffNumber: string;
    name: string;
    email: string;
    position: { title: string };
    orgUnit: { name: string };
  }> = [];
  let leaveTypes: Array<{ id: string; name: string; code: string; annualAllocation: number }> = [];
  let leaveRequests: Array<{
    id: string;
    status: string;
    startDate: string;
    endDate: string;
    durationDays: number;
    staff: { staffNumber: string };
    leaveType: { name: string };
  }> = [];
  let appraisals: Array<{
    id: string;
    status: string;
    type: string;
    staff: { staffNumber: string };
  }> = [];
  let workload: Array<{
    id: string;
    totalCreditHours: number;
    maxCreditHours: number;
    utilizationPct: number;
    overCapacity: boolean;
    staff: { staffNumber: string; name?: string };
  }> = [];
  let semesters: Array<{ id: string; name: string }> = [];
  let orgChartTree: unknown[] = [];

  const entityId = session.user.entityId;

  const [profRes, ltRes, lrRes, appRes, semRes] = await Promise.all([
    fetch(`${apiBase}/staff/profiles`, { headers, cache: 'no-store' }),
    fetch(`${apiBase}/staff/leave-types`, { headers, cache: 'no-store' }),
    fetch(`${apiBase}/staff/leave-requests`, { headers, cache: 'no-store' }),
    fetch(`${apiBase}/staff/appraisals`, { headers, cache: 'no-store' }),
    fetch(`${apiBase}/academic/catalog/semesters`, { headers, cache: 'no-store' }),
  ]);

  if (profRes.ok) {
    const j = (await profRes.json()) as { data?: typeof profiles };
    profiles = j.data ?? [];
  }
  if (ltRes.ok) {
    const j = (await ltRes.json()) as { data?: typeof leaveTypes };
    leaveTypes = j.data ?? [];
  }
  if (lrRes.ok) {
    const j = (await lrRes.json()) as { data?: typeof leaveRequests };
    leaveRequests = (j.data ?? []).map((r) => ({
      ...r,
      startDate: String(r.startDate),
      endDate: String(r.endDate),
    }));
  }
  if (appRes.ok) {
    const j = (await appRes.json()) as { data?: typeof appraisals };
    appraisals = j.data ?? [];
  }
  if (semRes.ok) {
    const j = (await semRes.json()) as
      | Array<{ id: string; name: string }>
      | { data?: Array<{ id: string; name: string }> };
    semesters = Array.isArray(j) ? j : (j.data ?? []);
  }

  const semesterId = semesters[0]?.id;
  if (semesterId) {
    const wRes = await fetch(
      `${apiBase}/staff/workload?semesterId=${encodeURIComponent(semesterId)}`,
      {
        headers,
        cache: 'no-store',
      },
    );
    if (wRes.ok) {
      const j = (await wRes.json()) as { data?: typeof workload };
      workload = j.data ?? [];
    }
  }

  if (entityId) {
    const ocRes = await fetch(
      `${apiBase}/staff/org-chart?entityId=${encodeURIComponent(entityId)}`,
      { headers, cache: 'no-store' },
    );
    if (ocRes.ok) {
      const oc = (await ocRes.json()) as { tree?: unknown[] };
      orgChartTree = oc.tree ?? [];
    }
  }

  return (
    <main
      style={{ padding: '2rem 2.5rem', maxWidth: 1100, minHeight: '100vh', background: '#f8fafc' }}
    >
      <Link
        href="/dashboard"
        style={{ color: '#2563eb', fontSize: '0.9rem', textDecoration: 'none' }}
      >
        ← Dashboard
      </Link>
      <h1 style={{ margin: '0.75rem 0 0', color: '#0f1729' }}>Staff & HR</h1>
      <p style={{ color: '#64748b', marginTop: '0.35rem' }}>
        Staff registry, leave, appraisals, workload, and org chart for your campus entity.
      </p>

      <StaffHubPanels
        profiles={profiles}
        leaveTypes={leaveTypes}
        leaveRequests={leaveRequests}
        appraisals={appraisals}
        workload={workload}
        semesters={semesters}
        orgChartTree={orgChartTree}
        canWrite={hasPermission(session.user.permissions, 'staff.write')}
      />
    </main>
  );
}
