import Link from 'next/link';
import { Suspense } from 'react';
import { auth } from '@/auth';
import { StaffDirectoryScope } from '@/components/staff/staff-directory-scope';
import { StaffHubPanels } from '@/components/staff/staff-hub-panels';
import type { LeaveCalendarEvent } from '@/components/staff/staff-leave-calendar';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { hasPermission } from '@/lib/permissions';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type OrgTreeNode = {
  id: string;
  name: string;
  children?: OrgTreeNode[];
};

function flattenOrgUnits(nodes: OrgTreeNode[]): Array<{ id: string; name: string }> {
  const out: Array<{ id: string; name: string }> = [];
  const walk = (list: OrgTreeNode[]) => {
    for (const node of list) {
      out.push({ id: node.id, name: node.name });
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const { scope: scopeParam } = await searchParams;
  const directoryScope = scopeParam === 'institution' ? 'institution' : 'entity';
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
    entity?: { id: string; code: string; name: string };
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
    staff: { staffNumber: string; positionId?: string };
    workflowInstance?: {
      id: string;
      currentStep: number;
      currentStepName: string | null;
      status: string;
    } | null;
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
  let academicYears: Array<{ id: string; name: string }> = [];
  let orgChartTree: OrgTreeNode[] = [];
  let calendarEvents: LeaveCalendarEvent[] = [];
  let orgUnits: Array<{ id: string; name: string }> = [];
  let positions: Array<{ id: string; title: string; orgUnitId: string }> = [];
  let myProfile: {
    id: string;
    staffNumber: string;
    name: string;
    email: string;
    photoUrl?: string | null;
    position: { title: string };
    orgUnit: { name: string };
    salary?: { amount: number; currency: string } | null;
  } | null = null;
  let entityAccess: {
    homeEntityId: string;
    teachingEntities: Array<{ id: string; code: string; name: string }>;
  } | null = null;
  let campusEntities: Array<{ id: string; name: string; code: string }> = [];
  let calendarOAuth = { google: false, microsoft: false };
  let leaveBalances: Array<{
    id: string;
    allocated: number;
    used: number;
    pending: number;
    carriedOver: number;
    staff: { staffNumber: string };
    leaveType: { name: string };
    academicYear: { name: string };
  }> = [];

  const entityId = session.user.entityId;

  const now = new Date();
  const calFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const calTo = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString();

  const profilesUrl =
    directoryScope === 'institution'
      ? `${apiBase}/staff/profiles?scope=institution`
      : `${apiBase}/staff/profiles`;

  const [profRes, ltRes, lrRes, appRes, semRes, yearRes, calRes, balRes, meRes] = await Promise.all(
    [
      fetch(profilesUrl, { headers, cache: 'no-store' }),
      fetch(`${apiBase}/staff/leave-types`, { headers, cache: 'no-store' }),
      fetch(`${apiBase}/staff/leave-requests`, { headers, cache: 'no-store' }),
      fetch(`${apiBase}/staff/appraisals`, { headers, cache: 'no-store' }),
      fetch(`${apiBase}/academic/catalog/semesters`, { headers, cache: 'no-store' }),
      fetch(`${apiBase}/academic/years`, { headers, cache: 'no-store' }),
      fetch(
        `${apiBase}/staff/leave-calendar?from=${encodeURIComponent(calFrom)}&to=${encodeURIComponent(calTo)}`,
        { headers, cache: 'no-store' },
      ),
      fetch(`${apiBase}/staff/leave-balances`, { headers, cache: 'no-store' }),
      fetch(`${apiBase}/staff/profiles/me`, { headers, cache: 'no-store' }),
    ],
  );

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
  if (yearRes.ok) {
    const j = (await yearRes.json()) as
      | Array<{ id: string; name: string }>
      | { data?: Array<{ id: string; name: string }> };
    academicYears = Array.isArray(j) ? j : (j.data ?? []);
  }
  if (calRes.ok) {
    const j = (await calRes.json()) as { events?: LeaveCalendarEvent[] };
    calendarEvents = j.events ?? [];
  }
  if (balRes.ok) {
    const j = (await balRes.json()) as { data?: typeof leaveBalances };
    leaveBalances = j.data ?? [];
  }
  if (meRes.ok) {
    myProfile = (await meRes.json()) as typeof myProfile;
    const eaRes = await fetch(
      `${apiBase}/staff/profiles/${encodeURIComponent(myProfile!.id)}/entity-access`,
      { headers, cache: 'no-store' },
    );
    if (eaRes.ok) {
      entityAccess = (await eaRes.json()) as typeof entityAccess;
    }
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

  const [entRes, calOAuthRes] = await Promise.all([
    fetch(`${apiBase}/institutions/${session.user.institutionId}/entities`, {
      headers,
      cache: 'no-store',
    }),
    fetch(`${apiBase}/staff/calendar-connect/status`, { headers, cache: 'no-store' }),
  ]);
  if (entRes.ok) {
    const j = (await entRes.json()) as { data?: typeof campusEntities };
    campusEntities = j.data ?? [];
  }
  if (calOAuthRes.ok) {
    calendarOAuth = (await calOAuthRes.json()) as typeof calendarOAuth;
  }

  if (entityId) {
    const [ocRes, treeRes, posRes] = await Promise.all([
      fetch(`${apiBase}/staff/org-chart?entityId=${encodeURIComponent(entityId)}`, {
        headers,
        cache: 'no-store',
      }),
      fetch(`${apiBase}/org-units/tree?entityId=${encodeURIComponent(entityId)}`, {
        headers,
        cache: 'no-store',
      }),
      fetch(`${apiBase}/positions?entityId=${encodeURIComponent(entityId)}`, {
        headers,
        cache: 'no-store',
      }),
    ]);
    if (ocRes.ok) {
      const oc = (await ocRes.json()) as { tree?: OrgTreeNode[] };
      orgChartTree = oc.tree ?? [];
    }
    if (treeRes.ok) {
      const treeBody = (await treeRes.json()) as { tree?: OrgTreeNode[] };
      orgUnits = flattenOrgUnits(treeBody.tree ?? []);
    }
    if (posRes.ok) {
      const posBody = (await posRes.json()) as {
        data?: Array<{ id: string; title: string; orgUnit: { id: string } }>;
      };
      positions = (posBody.data ?? []).map((p) => ({
        id: p.id,
        title: p.title,
        orgUnitId: p.orgUnit.id,
      }));
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
        Staff registry, leave, appraisals, workload, and org chart
        {directoryScope === 'institution' ? ' (all campuses)' : ' for your campus entity'}.
      </p>

      <Suspense fallback={null}>
        <StaffDirectoryScope />
      </Suspense>

      <StaffHubPanels
        directoryScope={directoryScope}
        profiles={profiles}
        leaveTypes={leaveTypes}
        leaveRequests={leaveRequests}
        appraisals={appraisals}
        workload={workload}
        semesters={semesters}
        academicYears={academicYears}
        orgChartTree={orgChartTree}
        calendarEvents={calendarEvents}
        orgUnits={orgUnits}
        positions={positions}
        myProfile={myProfile}
        entityAccess={entityAccess}
        leaveBalances={leaveBalances}
        icsExportUrl={`/staff/leave-calendar/export?from=${encodeURIComponent(calFrom)}&to=${encodeURIComponent(calTo)}`}
        campusEntities={campusEntities}
        calendarOAuth={calendarOAuth}
        canWrite={hasPermission(session.user.permissions, 'staff.write')}
      />
    </main>
  );
}
