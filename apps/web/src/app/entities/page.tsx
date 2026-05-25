import Link from 'next/link';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import {
  EntitiesDashboard,
  type ConsolidatedStatsPayload,
  type EntityListRow,
} from '@/components/entities/entities-dashboard';
import { EntitySwitcher } from '@/components/entity-switcher';
import { parseEntitySettings } from '@/lib/entity-settings';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
type InstitutionStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL';

export default async function EntitiesPage() {
  const session = await auth();
  if (!session?.accessToken || !session.user?.institutionId) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <p>Sign in to manage campus entities.</p>
        <Link href="/login" style={{ color: '#2563eb' }}>
          Login
        </Link>
      </main>
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);

  const canManageAll = session.user.entityScope === 'ALL';
  const perms = session.user.permissions ?? [];
  const hasCreatePermission = perms.includes('*') || perms.includes('institutions.write');

  const listRes = await fetch(`${apiBase}/institutions/${session.user.institutionId}/entities`, {
    headers,
    cache: 'no-store',
  });

  const institutionRes = hasCreatePermission
    ? await fetch(`${apiBase}/institutions/${session.user.institutionId}`, {
        headers,
        cache: 'no-store',
      })
    : null;

  const statsRes =
    canManageAll && listRes.ok
      ? await fetch(
          `${apiBase}/institutions/${session.user.institutionId}/entities/consolidated/stats`,
          {
            headers,
            cache: 'no-store',
          },
        )
      : null;

  const listJson = (await listRes.json().catch(() => null)) as {
    data?: {
      id: string;
      name: string;
      code: string;
      type: string;
      status: string;
      billableStudentCount?: number;
      settings?: unknown;
    }[];
  } | null;
  const rawRows = listJson?.data ?? [];
  const institutionJson = (await institutionRes?.json().catch(() => null)) as {
    status?: InstitutionStatus;
  } | null;
  const isTrialInstitution = institutionJson?.status === 'TRIAL';
  const canCreate = hasCreatePermission && !isTrialInstitution;

  let stats: ConsolidatedStatsPayload | null = null;
  if (statsRes?.ok) {
    stats = (await statsRes.json()) as ConsolidatedStatsPayload;
  }

  const statById = new Map(stats?.entities.map((e) => [e.entityId, e]) ?? []);
  const rows: EntityListRow[] = rawRows.map((r) => {
    const s = statById.get(r.id);
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      type: r.type,
      status: r.status,
      settings: parseEntitySettings(r.settings),
      billableStudentCount: r.billableStudentCount,
      inactiveStudentCount: s?.inactiveStudentCount,
      staffCount: s?.staffCount,
      enrollmentsCurrentAcademicYear: s?.enrollmentsCurrentAcademicYear,
      lastBillableSnapshotAt: s?.lastBillableSnapshotAt ?? null,
    };
  });

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 1040 }}>
      <h1 style={{ marginTop: 0 }}>Campus entities</h1>
      <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
        Active context: {session.user.entityId || '—'} · scope{' '}
        <strong>{session.user.entityScope}</strong>
      </p>
      <EntitySwitcher
        entities={rawRows.map((r) => ({
          id: r.id,
          name: `${r.name} (${r.code})`,
          code: r.code,
          billableStudentCount: r.billableStudentCount,
        }))}
      />
      <EntitiesDashboard
        rows={rows}
        stats={stats}
        canManageAll={canManageAll}
        canCreate={canCreate}
        createBlockedReason={
          canManageAll && hasCreatePermission && isTrialInstitution
            ? 'Trial institutions cannot create sub-institutions. Complete onboarding before adding campuses.'
            : undefined
        }
      />
      <p style={{ marginTop: '2rem' }}>
        <Link href="/dashboard" style={{ color: '#2563eb' }}>
          Back to dashboard
        </Link>
      </p>
    </main>
  );
}
