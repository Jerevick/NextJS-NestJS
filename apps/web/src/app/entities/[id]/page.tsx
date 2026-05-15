import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';
import { auth } from '@/auth';
import { BillingTrendChart } from '@/app/billing/billing-trend-chart';
import { EntityActivateButton } from '@/components/entities/entity-activate-button';
import { EntityMetaBadges } from '@/components/entities/entity-meta-badges';
import { EntitySettingsForm } from '@/components/entities/entity-settings-form';
import { EntitySuspendButton } from '@/components/entities/entity-suspend-button';
import { EntityTypeBadge } from '@/components/entities/entity-type-badge';
import { EntityUserAccessPanel } from '@/components/entities/entity-user-access-panel';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { parseEntitySettings, type ParsedEntitySettings } from '@/lib/entity-settings';
import { canAccessBillingNav, hasPermission } from '@/lib/permissions';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const ENTITY_TABS = ['overview', 'billing', 'students', 'staff', 'modules', 'settings', 'danger'] as const;
type EntityTab = (typeof ENTITY_TABS)[number];

function normalizeTab(raw: string | undefined): EntityTab {
  const t = raw?.toLowerCase();
  if (t && (ENTITY_TABS as readonly string[]).includes(t)) {
    return t as EntityTab;
  }
  return 'overview';
}

type ConsolidatedStatsPayload = {
  entities: Array<{
    entityId: string;
    code: string;
    name: string;
    billableStudentCount: number;
    inactiveStudentCount: number;
    totalStudentCount: number;
    staffCount?: number;
    enrollmentsCurrentAcademicYear?: number;
    lastBillableSnapshotAt?: string | null;
  }>;
};

function tabLinkStyle(active: boolean): CSSProperties {
  return {
    padding: '0.45rem 0.75rem',
    borderRadius: 8,
    fontSize: '0.88rem',
    fontWeight: active ? 700 : 500,
    textDecoration: 'none',
    color: active ? '#1e40af' : '#475569',
    background: active ? '#eff6ff' : 'transparent',
    border: active ? '1px solid #bfdbfe' : '1px solid transparent',
  };
}

export default async function EntityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id: entityId } = await params;
  const tab = normalizeTab((await searchParams).tab);

  const session = await auth();
  if (!session?.accessToken || !session.user?.institutionId) {
    return (
      <main style={{ padding: '2rem' }}>
        <Link href="/login">Sign in</Link>
      </main>
    );
  }

  const inst = session.user.institutionId;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': inst,
  };
  appendOptionalEntityHeader(headers, session.user);

  const canBilling = canAccessBillingNav(session.user.permissions);
  const canManageCampus =
    session.user.entityScope === 'ALL' &&
    (hasPermission(session.user.permissions, 'institutions.write') ||
      (session.user.permissions?.includes('*') ?? false));

  const [entityRes, snapRes, statsRes, userAccessRes] = await Promise.all([
    fetch(`${apiBase}/institutions/${inst}/entities/${entityId}`, {
      headers,
      cache: 'no-store',
    }),
    canBilling
      ? fetch(`${apiBase}/billing/snapshots/daily?entityId=${encodeURIComponent(entityId)}&limit=35`, {
          headers,
          cache: 'no-store',
        })
      : Promise.resolve(null as Response | null),
    fetch(`${apiBase}/institutions/${inst}/entities/consolidated/stats`, {
      headers,
      cache: 'no-store',
    }),
    canManageCampus
      ? fetch(`${apiBase}/institutions/${inst}/entities/${entityId}/user-access`, {
          headers,
          cache: 'no-store',
        })
      : Promise.resolve(null as Response | null),
  ]);

  if (!entityRes.ok) {
    if (entityRes.status === 404) {
      notFound();
    }
    return (
      <main style={{ padding: '2rem' }}>
        <p>Unable to load this campus ({entityRes.status}).</p>
        <Link href="/entities">Back</Link>
      </main>
    );
  }

  const entity = (await entityRes.json()) as {
    id: string;
    code: string;
    name: string;
    type: string;
    status: string;
    billableStudentCount?: number;
    settings?: ParsedEntitySettings;
  };
  const entitySettings = parseEntitySettings(entity.settings);

  const userAccessRows =
    userAccessRes && userAccessRes.ok
      ? ((await userAccessRes.json()) as Array<{
          id: string;
          userId: string;
          user: { email: string; role: string };
        }>)
      : [];

  const snaps =
    snapRes && snapRes.ok
      ? ((await snapRes.json()) as {
          data?: { snapshotDate: string; billableCount: number }[];
        })
      : { data: [] };

  const statsPayload =
    statsRes.ok ? ((await statsRes.json()) as ConsolidatedStatsPayload) : { entities: [] };
  const statRow = statsPayload.entities.find((e) => e.entityId === entityId);

  const trendPoints = [...(snaps.data ?? [])]
    .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate))
    .slice(-30)
    .map((s) => ({
      date: s.snapshotDate.slice(0, 10),
      total: s.billableCount,
    }));

  const lastSnap = trendPoints.length > 0 ? trendPoints[trendPoints.length - 1]?.date : null;
  const isMainCampus = entity.code === 'MAIN';

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 960 }}>
      <p style={{ marginTop: 0 }}>
        <Link href="/entities" style={{ color: '#2563eb' }}>
          ← All campuses
        </Link>
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>{entity.name}</h1>
        <EntityTypeBadge type={entity.type} />
        <EntityMetaBadges
          coupling={entitySettings.coupling}
          billingClassification={entitySettings.billingClassification}
        />
        <span style={{ fontSize: '0.9rem', color: '#64748b' }}>
          {entity.code} · {entity.status}
        </span>
      </div>

      <nav
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.35rem',
          marginTop: '1.25rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid #e2e8f0',
        }}
        aria-label="Campus sections"
      >
        {ENTITY_TABS.map((t) => (
          <Link key={t} href={t === 'overview' ? `/entities/${entityId}` : `/entities/${entityId}?tab=${t}`} style={tabLinkStyle(tab === t)}>
            {t === 'danger' ? 'Danger zone' : t.charAt(0).toUpperCase() + t.slice(1)}
          </Link>
        ))}
      </nav>

      {tab === 'overview' ? (
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem' }}>Overview</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginTop: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Billable (ACTIVE)</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{statRow?.billableStudentCount ?? entity.billableStudentCount ?? '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Inactive</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 600, color: '#64748b' }}>{statRow?.inactiveStudentCount ?? '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total students</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 600 }}>{statRow?.totalStudentCount ?? '—'}</div>
            </div>
            {typeof statRow?.staffCount === 'number' ? (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Staff (campus)</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 600 }}>{statRow.staffCount}</div>
              </div>
            ) : null}
            {typeof statRow?.enrollmentsCurrentAcademicYear === 'number' && statRow.enrollmentsCurrentAcademicYear > 0 ? (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Enrolled seats (current AY)</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 600 }}>{statRow.enrollmentsCurrentAcademicYear}</div>
              </div>
            ) : null}
          </div>
          {statRow?.lastBillableSnapshotAt ? (
            <p style={{ marginTop: '0.75rem', color: '#64748b', fontSize: '0.88rem' }}>
              Latest daily billable snapshot (UTC): <strong>{statRow.lastBillableSnapshotAt.slice(0, 10)}</strong>
            </p>
          ) : null}
          <p style={{ marginTop: '1rem', color: '#64748b', fontSize: '0.9rem', maxWidth: 640 }}>
            Billable counts follow the status-only contract: ACTIVE enrollment is billed; other statuses are not.
          </p>
        </section>
      ) : null}

      {tab === 'billing' ? (
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem' }}>Billing</h2>
          {!canBilling ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>You do not have billing access for charts on this page.</p>
          ) : (
            <>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.35rem' }}>
                Daily billable headcount for this campus (latest UTC day in chart: {lastSnap ?? '—'}).
              </p>
              <div style={{ marginTop: '1rem', height: 280 }}>
                <BillingTrendChart points={trendPoints} height={280} valueLabel="Billable (this campus)" />
              </div>
              <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                <Link href="/billing" style={{ color: '#2563eb', fontWeight: 600 }}>
                  Institution billing
                </Link>
                {' · '}
                <Link href="/billing/disputes" style={{ color: '#2563eb', fontWeight: 600 }}>
                  Billing disputes
                </Link>
              </p>
            </>
          )}
        </section>
      ) : null}

      {tab === 'students' ? (
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem' }}>Students</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: 640 }}>
            The roster is scoped by your active campus in the session JWT. Use the campus switcher on the entities list
            to match this campus, then open Students — or stay on your current context if you only need a quick link.
          </p>
          <p style={{ marginTop: '0.75rem' }}>
            <Link href="/students" style={{ color: '#2563eb', fontWeight: 600 }}>
              Open students
            </Link>
          </p>
        </section>
      ) : null}

      {tab === 'staff' ? (
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem' }}>Staff</h2>
          {typeof statRow?.staffCount === 'number' ? (
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
              Distinct staff profiles on this campus: <strong>{statRow.staffCount}</strong>
            </p>
          ) : null}
          {canManageCampus ? (
            <EntityUserAccessPanel institutionId={inst} entityId={entityId} initialRows={userAccessRows} />
          ) : (
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.75rem' }}>
              Cross-campus access grants require institution-wide scope and <strong>institutions.write</strong>.
            </p>
          )}
        </section>
      ) : null}

      {tab === 'modules' ? (
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem' }}>Modules</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Tenant modules (SIS, LMS, etc.) are configured at institution level. Entity-level module overrides will
            appear here when the provisioning pipeline exposes them.
          </p>
        </section>
      ) : null}

      {tab === 'settings' ? (
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem' }}>Settings</h2>
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: '140px 1fr',
              gap: '0.5rem 1rem',
              fontSize: '0.92rem',
              maxWidth: 520,
              marginBottom: '1.25rem',
            }}
          >
            <dt style={{ color: '#64748b' }}>Code</dt>
            <dd style={{ margin: 0, fontFamily: 'ui-monospace, monospace' }}>{entity.code}</dd>
            <dt style={{ color: '#64748b' }}>Type</dt>
            <dd style={{ margin: 0 }}>{entity.type}</dd>
            <dt style={{ color: '#64748b' }}>Status</dt>
            <dd style={{ margin: 0 }}>{entity.status}</dd>
            <dt style={{ color: '#64748b' }}>Coupling / billing</dt>
            <dd style={{ margin: 0 }}>
              <EntityMetaBadges
                coupling={entitySettings.coupling}
                billingClassification={entitySettings.billingClassification}
              />
            </dd>
          </dl>
          <EntitySettingsForm
            institutionId={inst}
            entityId={entityId}
            initialName={entity.name}
            settings={entitySettings}
            canEdit={canManageCampus}
          />
        </section>
      ) : null}

      {tab === 'danger' ? (
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', color: '#991b1b' }}>Danger zone</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: 640 }}>
            Suspending a campus marks it non-operational for this institution and flushes sessions for users tied to
            this entity. This cannot be applied to the MAIN campus.
          </p>
          {canManageCampus ? (
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <EntityActivateButton entityId={entity.id} entityCode={entity.code} status={entity.status} />
              <EntitySuspendButton entityId={entity.id} entityCode={entity.code} isMainCampus={isMainCampus} />
            </div>
          ) : (
            <p style={{ marginTop: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
              You need <strong>institutions.write</strong> and institution-wide scope (<strong>entityScope ALL</strong>)
              to manage campus lifecycle.
            </p>
          )}
        </section>
      ) : null}
    </main>
  );
}
