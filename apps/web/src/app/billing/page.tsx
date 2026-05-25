import Link from 'next/link';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { canAccessBillingNav, hasPermission } from '@/lib/permissions';
import { BillingTrendChart, type BillableTrendPoint } from './billing-trend-chart';
import {
  BillingInvoicesDataGrid,
  BillingSnapshotsDataGrid,
  BillingSummariesDataGrid,
  type DailySnapshotGridRow,
  type InvoiceGridRow,
  type MonthlySummaryGridRow,
} from '@/components/data-grids/billing-data-grids';
import {
  ComputeMonthlyForm,
  FinalizeInvoiceForm,
  GenerateDraftForm,
  LockSnapshotsForm,
  RunSnapshotsForm,
  UnlockSnapshotsForm,
} from './billing-forms';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function defaultBillingPeriod(): { year: number; month: number } {
  const now = new Date();
  const ref = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return { year: ref.getUTCFullYear(), month: ref.getUTCMonth() + 1 };
}

function prevYm(y: number, m: number): { year: number; month: number } {
  if (m <= 1) {
    return { year: y - 1, month: 12 };
  }
  return { year: y, month: m - 1 };
}

function sumWatermarks(rows: { watermarkCount: number }[]): number {
  return rows.reduce((a, r) => a + r.watermarkCount, 0);
}

function buildTrendPoints(
  rows: Array<{ snapshotDate: string; billableCount: number }>,
): BillableTrendPoint[] {
  const by = new Map<string, number>();
  for (const r of rows) {
    const d = r.snapshotDate.slice(0, 10);
    by.set(d, (by.get(d) ?? 0) + r.billableCount);
  }
  return [...by.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-30)
    .map(([date, total]) => ({ date, total }));
}

type ConsolidatedEntity = {
  entityId: string;
  code: string;
  name: string;
  billableStudentCount: number;
  inactiveStudentCount: number;
  totalStudentCount: number;
  staffCount?: number;
  enrollmentsCurrentAcademicYear?: number;
  lastBillableSnapshotAt?: string | null;
};

export default async function BillingPage() {
  const session = await auth();
  if (!session?.accessToken || !session.user?.institutionId) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <p>Sign in to view billing.</p>
        <Link href="/login" style={{ color: '#2563eb' }}>
          Login
        </Link>
      </main>
    );
  }

  if (!canAccessBillingNav(session.user.permissions)) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <p>You do not have permission to view billing.</p>
        <Link href="/dashboard" style={{ color: '#2563eb' }}>
          Dashboard
        </Link>
      </main>
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);

  const { year, month } = defaultBillingPeriod();
  const prev = prevYm(year, month);
  const qs = new URLSearchParams({ year: String(year), month: String(month), limit: '50' });
  const qsPrev = new URLSearchParams({
    year: String(prev.year),
    month: String(prev.month),
    limit: '50',
  });

  const [invRes, sumRes, sumPrevRes, snapRes, statsRes] = await Promise.all([
    fetch(`${apiBase}/billing/invoices?limit=20`, { headers, cache: 'no-store' }),
    fetch(`${apiBase}/billing/monthly-summaries?${qs.toString()}`, { headers, cache: 'no-store' }),
    fetch(`${apiBase}/billing/monthly-summaries?${qsPrev.toString()}`, {
      headers,
      cache: 'no-store',
    }),
    fetch(`${apiBase}/billing/snapshots/daily?limit=120`, { headers, cache: 'no-store' }),
    fetch(`${apiBase}/institutions/${session.user.institutionId}/entities/consolidated/stats`, {
      headers,
      cache: 'no-store',
    }),
  ]);

  const invoices = invRes.ok
    ? ((await invRes.json()) as {
        data?: {
          id: string;
          amount: string;
          status: string;
          dueDate: string | null;
          lockedAt: string | null;
          isRetroactive: boolean;
          createdAt: string;
        }[];
      })
    : { data: [] };
  const summaries = sumRes.ok
    ? ((await sumRes.json()) as {
        data?: {
          id: string;
          entity?: { code: string; name: string };
          watermarkCount: number;
          peakDailyCount: number;
          averageDailyCount: string;
        }[];
      })
    : { data: [] };
  const summariesPrev = sumPrevRes.ok
    ? ((await sumPrevRes.json()) as { data?: { watermarkCount: number }[] })
    : { data: [] };
  const snapshots = snapRes.ok
    ? ((await snapRes.json()) as {
        data?: {
          id: string;
          snapshotDate: string;
          billableCount: number;
          isLockedForBilling: boolean;
          entity?: { code: string };
        }[];
      })
    : { data: [] };

  const statsPayload = statsRes.ok
    ? ((await statsRes.json()) as {
        institutionTotals?: {
          billableStudentCount: number;
          inactiveStudentCount: number;
          totalStudentCount: number;
          enrollmentsCurrentAcademicYear?: number;
        };
        entities?: ConsolidatedEntity[];
      })
    : null;

  const entities: ConsolidatedEntity[] = statsPayload?.entities ?? [];
  const totals = statsPayload?.institutionTotals ?? {
    billableStudentCount: 0,
    inactiveStudentCount: 0,
    totalStudentCount: 0,
    enrollmentsCurrentAcademicYear: 0,
  };

  const wm = sumWatermarks(summaries.data ?? []);
  const wmPrev = sumWatermarks(summariesPrev.data ?? []);
  const delta = wm - wmPrev;
  const deltaPct = wmPrev > 0 ? ((delta / wmPrev) * 100).toFixed(1) : wm > 0 ? '—' : '0.0';

  const trendPoints = buildTrendPoints(snapshots.data ?? []);
  const now = new Date();
  const draftInvoices = (invoices.data ?? []).filter((i) => i.status === 'DRAFT' && !i.lockedAt);

  const canWrite = hasPermission(session.user.permissions, 'billing.write');
  const isSuper = session.user.permissions?.includes('*') ?? false;
  const periodLabel = `${year}-${String(month).padStart(2, '0')}`;
  const mono = { fontFamily: 'ui-monospace, monospace' } as const;

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 1100 }}>
      <h1 style={{ marginTop: 0 }}>Billing</h1>
      <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
        Headcount context for <strong>{periodLabel}</strong> (previous UTC calendar month).
        Institution: <span style={mono}>{session.user.institutionId}</span>
      </p>
      <nav style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Link href="/dashboard" style={{ color: '#2563eb' }}>
          ← Dashboard
        </Link>
        <Link href="/dashboard/billing/disputes" style={{ color: '#2563eb' }}>
          Billing disputes
        </Link>
        <Link href="/dashboard/billing/snapshot" style={{ color: '#2563eb' }}>
          Daily snapshots
        </Link>
      </nav>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.75rem',
        }}
      >
        <div
          style={{
            border: '1px solid #bbf7d0',
            borderRadius: 10,
            padding: '1rem 1.15rem',
            background: '#f0fdf4',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '0.72rem',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#166534',
            }}
          >
            Billable students (ACTIVE) today
          </p>
          <p
            style={{
              margin: '0.35rem 0 0',
              fontSize: '1.75rem',
              fontWeight: 800,
              color: '#14532d',
              ...mono,
            }}
          >
            {totals.billableStudentCount.toLocaleString()}
          </p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: '#3f6212' }}>
            Not billed — inactive:{' '}
            <strong style={mono}>{totals.inactiveStudentCount.toLocaleString()}</strong>
          </p>
        </div>
        <div
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: '1rem 1.15rem',
            background: '#fff',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '0.72rem',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#64748b',
            }}
          >
            Monthly watermark total ({periodLabel})
          </p>
          <p
            style={{
              margin: '0.35rem 0 0',
              fontSize: '1.35rem',
              fontWeight: 700,
              color: '#0f172a',
              ...mono,
            }}
          >
            {wm}
          </p>
          <p style={{ margin: '0.45rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
            vs prior month watermark sum:{' '}
            <strong style={{ color: delta >= 0 ? '#15803d' : '#b91c1c' }}>
              {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)} ({deltaPct}%)
            </strong>
          </p>
        </div>
        <div
          style={{
            border: '1px solid #fef08a',
            borderRadius: 10,
            padding: '1rem 1.15rem',
            background: '#fefce8',
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '0.72rem',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#854d0e',
            }}
          >
            Draft invoices
          </p>
          <p
            style={{
              margin: '0.35rem 0 0',
              fontSize: '1.35rem',
              fontWeight: 700,
              color: '#713f12',
              ...mono,
            }}
          >
            {draftInvoices.length}
          </p>
          <p style={{ margin: '0.45rem 0 0', fontSize: '0.82rem', color: '#854d0e' }}>
            Finalize from the actions block or open an invoice below.
          </p>
        </div>
      </section>

      {entities.length > 0 ? (
        <section style={{ marginBottom: '1.75rem' }}>
          <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.5rem' }}>Entity breakdown</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
            Billable = ACTIVE enrollment (status contract). Counts from consolidated campus stats.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {entities.map((e) => (
              <span
                key={e.entityId}
                style={{
                  fontSize: '0.82rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: 999,
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  ...mono,
                }}
              >
                {e.code}: <strong style={{ color: '#15803d' }}>{e.billableStudentCount}</strong>{' '}
                billable ·{' '}
                <span style={{ color: '#64748b' }}>{e.inactiveStudentCount} inactive</span>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section
        style={{
          marginBottom: '2rem',
          padding: '1rem',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>
          30-day billable trend (daily snapshots)
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: 0 }}>
          Sum of snapshot <span style={mono}>billableCount</span> across campuses per UTC day —
          drives monthly watermarks.
        </p>
        <BillingTrendChart points={trendPoints} valueLabel="Billable (sum of entities)" />
      </section>

      {canWrite ? (
        <section
          style={{ marginBottom: '2rem', padding: '1rem', background: '#f8fafc', borderRadius: 8 }}
        >
          <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Actions</h2>
          <RunSnapshotsForm />
          <ComputeMonthlyForm year={year} month={month} />
          <GenerateDraftForm year={year} month={month} />
          <FinalizeInvoiceForm />
        </section>
      ) : null}

      {isSuper ? (
        <section
          style={{ marginBottom: '2rem', padding: '1rem', background: '#fff7ed', borderRadius: 8 }}
        >
          <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Platform: snapshot lock / unlock</h2>
          <p style={{ fontSize: '0.85rem', color: '#9a3412' }}>
            Requires wildcard permission. Every change is audit-logged with your reason.
          </p>
          <h3 style={{ fontSize: '0.95rem' }}>Lock range</h3>
          <LockSnapshotsForm defaultInstitutionId={session.user.institutionId} />
          <h3 style={{ fontSize: '0.95rem' }}>Unlock range</h3>
          <UnlockSnapshotsForm defaultInstitutionId={session.user.institutionId} />
        </section>
      ) : null}

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem' }}>Invoices</h2>
        {!invRes.ok ? (
          <p style={{ color: '#b91c1c' }}>Could not load invoices ({invRes.status}).</p>
        ) : null}
        <BillingInvoicesDataGrid
          rows={(invoices.data ?? []).map((r): InvoiceGridRow => {
            const due = r.dueDate;
            const overdue =
              r.status === 'OPEN' && due !== null && new Date(due).getTime() < now.getTime();
            return {
              id: r.id,
              status: r.status,
              amount: r.amount,
              isRetroactive: r.isRetroactive,
              lockedAt: r.lockedAt,
              dueDate: r.dueDate,
              overdue,
            };
          })}
        />
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem' }}>Monthly summaries ({periodLabel})</h2>
        {!sumRes.ok ? (
          <p style={{ color: '#b91c1c' }}>Could not load summaries ({sumRes.status}).</p>
        ) : null}
        <BillingSummariesDataGrid
          rows={(summaries.data ?? []).map(
            (r): MonthlySummaryGridRow => ({
              id: r.id,
              campus: r.entity ? `${r.entity.code} — ${r.entity.name}` : '—',
              watermarkCount: r.watermarkCount,
              peakDailyCount: r.peakDailyCount,
              averageDailyCount: String(r.averageDailyCount),
            }),
          )}
        />
      </section>

      <section>
        <h2 style={{ fontSize: '1.1rem' }}>Recent daily snapshots</h2>
        {!snapRes.ok ? (
          <p style={{ color: '#b91c1c' }}>Could not load snapshots ({snapRes.status}).</p>
        ) : null}
        <BillingSnapshotsDataGrid
          rows={(snapshots.data ?? []).map(
            (r): DailySnapshotGridRow => ({
              id: r.id,
              snapshotDate: r.snapshotDate ?? '',
              campus: r.entity?.code ?? '—',
              billableCount: r.billableCount,
              isLockedForBilling: r.isLockedForBilling,
            }),
          )}
        />
      </section>
    </main>
  );
}
