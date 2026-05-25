'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import { motion } from 'framer-motion';
import type {
  EntitiesBillableChart as EntitiesBillableChartComponent,
  EntityChartRow,
} from './entities-billable-chart';

const EntitiesBillableChart = dynamic<ComponentProps<typeof EntitiesBillableChartComponent>>(
  () => import('./entities-billable-chart.js').then((m) => m.EntitiesBillableChart),
  { ssr: false },
);
import type { ParsedEntitySettings } from '@/lib/entity-settings';
import { EntityMetaBadges } from './entity-meta-badges';
import { EntityTypeBadge } from './entity-type-badge';

export interface EntityListRow {
  id: string;
  code: string;
  name: string;
  type: string;
  status: string;
  settings?: ParsedEntitySettings;
  billableStudentCount?: number;
  inactiveStudentCount?: number;
  staffCount?: number;
  enrollmentsCurrentAcademicYear?: number;
  lastBillableSnapshotAt?: string | null;
}

export interface ConsolidatedStatsPayload {
  institutionTotals: {
    billableStudentCount: number;
    inactiveStudentCount: number;
    totalStudentCount: number;
    enrollmentsCurrentAcademicYear?: number;
  };
  entities: Array<{
    entityId: string;
    code: string;
    name: string;
    type: string;
    status: string;
    billableStudentCount: number;
    inactiveStudentCount: number;
    totalStudentCount: number;
    staffCount: number;
    enrollmentsCurrentAcademicYear: number;
    lastBillableSnapshotAt: string | null;
  }>;
}

export function EntitiesDashboard({
  rows,
  stats,
  canManageAll,
  canCreate,
  createBlockedReason,
}: {
  rows: EntityListRow[];
  stats: ConsolidatedStatsPayload | null;
  canManageAll: boolean;
  canCreate: boolean;
  createBlockedReason?: string;
}) {
  const chartRows: EntityChartRow[] =
    stats?.entities.map((e) => ({
      code: e.code,
      billable: e.billableStudentCount,
      inactive: e.inactiveStudentCount,
    })) ?? [];

  return (
    <div>
      {stats ? (
        <motion.section
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '1.25rem',
            marginBottom: '1.5rem',
            background: '#fafafa',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Consolidated billable students</h2>
          <p style={{ margin: '0.35rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
            ACTIVE (billable) across all campuses
          </p>
          <p style={{ margin: '0.75rem 0 0', fontSize: '2rem', fontWeight: 700, color: '#0f172a' }}>
            {stats.institutionTotals.billableStudentCount.toLocaleString()}
          </p>
          <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.85rem' }}>
            Total students: {stats.institutionTotals.totalStudentCount.toLocaleString()} · Inactive:{' '}
            {stats.institutionTotals.inactiveStudentCount.toLocaleString()}
            {(stats.institutionTotals.enrollmentsCurrentAcademicYear ?? 0) > 0 ? (
              <>
                {' '}
                · Enrolled seats (current academic year):{' '}
                {(stats.institutionTotals.enrollmentsCurrentAcademicYear ?? 0).toLocaleString()}
              </>
            ) : null}
          </p>
          <EntitiesBillableChart rows={chartRows} />
        </motion.section>
      ) : null}

      {!canManageAll ? (
        <p style={{ color: '#64748b', marginBottom: '1rem', fontSize: '0.95rem' }}>
          Full entity management (summary charts, create campus) requires institution-wide scope (
          <strong>entityScope ALL</strong>), typically VC / Registrar.
        </p>
      ) : null}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Campuses</h2>
        {canManageAll && canCreate ? (
          <Link
            href="/dashboard/entities/new"
            style={{
              display: 'inline-block',
              padding: '0.45rem 0.9rem',
              borderRadius: 8,
              background: '#2563eb',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.9rem',
              textDecoration: 'none',
            }}
          >
            Add campus
          </Link>
        ) : null}
      </div>
      {createBlockedReason ? (
        <p style={{ color: '#b45309', margin: '0.75rem 0 0', fontSize: '0.9rem' }}>
          {createBlockedReason}
        </p>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '1rem',
          marginTop: '1rem',
        }}
      >
        {rows.map((r, i) => (
          <motion.article
            key={r.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: '1rem',
              background: '#fff',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{r.name}</div>
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{r.code}</div>
              </div>
              <EntityTypeBadge type={r.type} />
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Status: <strong style={{ color: '#0f172a' }}>{r.status}</strong>
            </div>
            <EntityMetaBadges
              coupling={r.settings?.coupling}
              billingClassification={r.settings?.billingClassification}
            />
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>
                  Billable
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>
                  {r.billableStudentCount ?? '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Inactive</div>
                <div style={{ fontSize: '1rem', color: '#64748b' }}>
                  {r.inactiveStudentCount ?? '—'}
                </div>
              </div>
              {typeof r.staffCount === 'number' ? (
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Staff</div>
                  <div style={{ fontSize: '1rem', color: '#475569' }}>{r.staffCount}</div>
                </div>
              ) : null}
              {typeof r.enrollmentsCurrentAcademicYear === 'number' &&
              r.enrollmentsCurrentAcademicYear > 0 ? (
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Enrollments</div>
                  <div style={{ fontSize: '1rem', color: '#475569' }}>
                    {r.enrollmentsCurrentAcademicYear}
                  </div>
                </div>
              ) : null}
            </div>
            {r.lastBillableSnapshotAt ? (
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Last daily snapshot (UTC): {r.lastBillableSnapshotAt.slice(0, 10)}
              </div>
            ) : null}
            <Link
              href={`/dashboard/entities/${r.id}`}
              style={{
                marginTop: 'auto',
                fontSize: '0.9rem',
                fontWeight: 600,
                color: '#2563eb',
                textDecoration: 'none',
              }}
            >
              Manage →
            </Link>
          </motion.article>
        ))}
      </div>
    </div>
  );
}
