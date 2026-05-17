import Link from 'next/link';
import type { CSSProperties } from 'react';
import {
  InstitutionEntitiesDataGrid,
  type EntityGridRow,
} from '@/components/data-grids/institutions-data-grid';
import {
  getMonitoringInstitutionAudit,
  getMonitoringInstitutionUsage,
  getSuperAdminInstitution,
} from '@/lib/platform-api';

type EntityRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
  activeStudentCount: number;
};

const tabStyle = (active: boolean): CSSProperties => ({
  padding: '0.4rem 0.75rem',
  borderRadius: 6,
  textDecoration: 'none',
  fontSize: '0.85rem',
  background: active ? '#1e3a5f' : 'transparent',
  color: active ? '#93c5fd' : '#94a3b8',
  border: active ? '1px solid #2563eb' : '1px solid transparent',
});

export default async function InstitutionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const tab = tabParam ?? 'overview';

  const [detail, usage, audit] = await Promise.all([
    getSuperAdminInstitution(id),
    getMonitoringInstitutionUsage(id),
    getMonitoringInstitutionAudit(id),
  ]);

  const name = detail.mode === 'live' ? detail.name : 'Institution';
  const healthScore = detail.mode === 'live' ? String(detail.health.healthScore) : '—';
  const entities: EntityRow[] = detail.mode === 'live' ? detail.entities : [];

  return (
    <main style={{ padding: '2rem', maxWidth: 960 }}>
      <p style={{ marginTop: 0 }}>
        <Link href="/institutions" style={{ color: '#60a5fa' }}>
          ← Institutions
        </Link>
      </p>
      <h1 style={{ fontSize: '1.25rem', marginTop: 0 }}>{name}</h1>
      <p style={{ color: '#64748b', fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem' }}>
        {id}
        {detail.mode === 'live' ? ` · ${detail.slug}` : null}
      </p>

      <nav style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
        <Link href={`/institutions/${id}?tab=overview`} style={tabStyle(tab === 'overview')}>
          Overview
        </Link>
        <Link href={`/institutions/${id}?tab=entities`} style={tabStyle(tab === 'entities')}>
          Entities
        </Link>
        <Link href={`/institutions/${id}?tab=usage`} style={tabStyle(tab === 'usage')}>
          Usage
        </Link>
        <Link href={`/institutions/${id}?tab=audit`} style={tabStyle(tab === 'audit')}>
          Audit
        </Link>
      </nav>

      {tab === 'overview' && detail.mode === 'live' ? (
        <section style={{ marginTop: '1.5rem' }}>
          <dl
            style={{
              display: 'grid',
              gridTemplateColumns: '160px 1fr',
              gap: '0.45rem 1rem',
              fontSize: '0.9rem',
            }}
          >
            <dt style={{ color: '#64748b' }}>Status</dt>
            <dd style={{ margin: 0 }}>{detail.status}</dd>
            <dt style={{ color: '#64748b' }}>Plan</dt>
            <dd style={{ margin: 0 }}>{detail.plan}</dd>
            <dt style={{ color: '#64748b' }}>Health score</dt>
            <dd style={{ margin: 0 }}>{healthScore}</dd>
            <dt style={{ color: '#64748b' }}>Billable students</dt>
            <dd style={{ margin: 0 }}>{detail.currentStudentCount}</dd>
            <dt style={{ color: '#64748b' }}>Billing day</dt>
            <dd style={{ margin: 0 }}>{detail.billingDayOfMonth ?? '—'}</dd>
            <dt style={{ color: '#64748b' }}>Min. billable</dt>
            <dd style={{ margin: 0 }}>{detail.minimumBillableCount ?? '—'}</dd>
            <dt style={{ color: '#64748b' }}>Dispute window (days)</dt>
            <dd style={{ margin: 0 }}>{detail.disputeWindowDays ?? '—'}</dd>
          </dl>
          {detail.subscription ? (
            <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#94a3b8' }}>
              Subscription: {detail.subscription.amount} {detail.subscription.billingCycle}
            </p>
          ) : null}
        </section>
      ) : null}

      {tab === 'overview' && detail.mode !== 'live' ? (
        <p style={{ color: '#fbbf24', marginTop: '1.5rem' }}>
          {detail.mode === 'mock'
            ? 'Configure ADMIN_API_BEARER for institution detail.'
            : 'message' in detail
              ? String(detail.message)
              : 'Unable to load institution.'}
        </p>
      ) : null}

      {tab === 'entities' ? (
        <section style={{ marginTop: '1.5rem' }}>
          {entities.length === 0 ? (
            <p style={{ color: '#64748b' }}>No entities.</p>
          ) : (
            <InstitutionEntitiesDataGrid
              rows={entities.map(
                (e): EntityGridRow => ({
                  id: e.id,
                  code: e.code,
                  name: e.name,
                  type: e.type,
                  activeStudentCount: e.activeStudentCount,
                }),
              )}
            />
          )}
        </section>
      ) : null}

      {tab === 'usage' ? (
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', color: '#94a3b8' }}>Usage</h2>
          {usage.mode === 'live' ? (
            <pre
              style={{
                background: '#020617',
                padding: '1rem',
                borderRadius: 8,
                overflow: 'auto',
                fontSize: '0.75rem',
              }}
            >
              {JSON.stringify(usage, null, 2)}
            </pre>
          ) : (
            <p style={{ color: '#fbbf24' }}>
              {'message' in usage ? String(usage.message) : 'No usage data.'}
            </p>
          )}
        </section>
      ) : null}

      {tab === 'audit' ? (
        <section style={{ marginTop: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', color: '#94a3b8' }}>Audit log (latest)</h2>
          {audit.mode === 'live' && Array.isArray(audit.data) ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {(
                audit.data as { id: string; action: string; entity: string; createdAt: string }[]
              ).map((e) => (
                <li
                  key={e.id}
                  style={{
                    borderBottom: '1px solid #0f172a',
                    padding: '0.5rem 0',
                    fontSize: '0.85rem',
                    fontFamily: 'ui-monospace, monospace',
                  }}
                >
                  <span style={{ color: '#64748b' }}>{String(e.createdAt)}</span> · {e.action} ·{' '}
                  {e.entity}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: '#94a3b8' }}>
              {audit.mode === 'mock' && 'notice' in audit
                ? String(audit.notice)
                : 'message' in audit
                  ? String(audit.message)
                  : 'No audit entries.'}
            </p>
          )}
        </section>
      ) : null}
    </main>
  );
}
