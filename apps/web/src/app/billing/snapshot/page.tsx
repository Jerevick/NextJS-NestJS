import Link from 'next/link';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import {
  SnapshotHistoryDataGrid,
  type SnapshotHistoryGridRow,
} from '@/components/data-grids/misc-data-grids';
import { canAccessBillingNav } from '@/lib/permissions';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const primary = '#1e3a5f';
const muted = '#64748b';

type SnapshotRow = {
  id: string;
  snapshotDate: string;
  billableCount: number;
  isLockedForBilling: boolean;
  entity?: { code: string; name: string };
};

function defaultPeriod(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

export default async function BillingSnapshotPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();

  if (!session?.accessToken || !session.user?.institutionId) {
    return (
      <main style={{ padding: '2rem', fontFamily: '"IBM Plex Sans", system-ui' }}>
        <p>Sign in to view billing snapshots.</p>
        <Link href="/login">Login</Link>
      </main>
    );
  }

  if (!canAccessBillingNav(session.user.permissions)) {
    return (
      <main style={{ padding: '2rem' }}>
        <p>No billing access.</p>
        <Link href="/dashboard">Dashboard</Link>
      </main>
    );
  }

  const period = defaultPeriod();
  const year = sp.year ? Number(sp.year) : period.year;
  const month = sp.month ? Number(sp.month) : period.month;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);

  const qs = new URLSearchParams({
    year: String(year),
    month: String(month),
    limit: '100',
  });

  const snapRes = await fetch(`${apiBase}/billing/snapshots/daily?${qs.toString()}`, {
    headers,
    cache: 'no-store',
  });

  const rows: SnapshotRow[] = snapRes.ok
    ? (((await snapRes.json()) as { data?: SnapshotRow[] }).data ?? [])
    : [];

  const byDate = new Map<string, { total: number; rows: SnapshotRow[] }>();
  for (const r of rows) {
    const d = r.snapshotDate.slice(0, 10);
    const entry = byDate.get(d) ?? { total: 0, rows: [] };
    entry.total += r.billableCount;
    entry.rows.push(r);
    byDate.set(d, entry);
  }
  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a));

  return (
    <main
      style={{
        padding: '2rem 1.5rem',
        maxWidth: 960,
        margin: '0 auto',
        fontFamily: '"IBM Plex Sans", system-ui',
      }}
    >
      <nav style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
        <Link href="/dashboard/billing" style={{ color: primary }}>
          ← Billing overview
        </Link>
        <Link href="/dashboard" style={{ color: muted }}>
          Dashboard
        </Link>
      </nav>

      <h1 style={{ fontFamily: '"Crimson Pro", Georgia, serif', color: primary, marginTop: 0 }}>
        Daily snapshot history
      </h1>
      <p style={{ color: muted, fontSize: '0.9rem', maxWidth: 560 }}>
        This is your institution&apos;s daily active student count as computed by UniCore. These
        numbers form the basis of your invoice.
      </p>

      <form
        method="get"
        style={{ display: 'flex', gap: '0.75rem', margin: '1.25rem 0', alignItems: 'end' }}
      >
        <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
          Year
          <input
            name="year"
            type="number"
            defaultValue={year}
            min={2020}
            max={2100}
            style={{ padding: '0.4rem' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
          Month
          <input
            name="month"
            type="number"
            defaultValue={month}
            min={1}
            max={12}
            style={{ padding: '0.4rem' }}
          />
        </label>
        <button type="submit" style={{ padding: '0.45rem 0.85rem', fontWeight: 600 }}>
          Apply
        </button>
      </form>

      {!snapRes.ok ? (
        <p style={{ color: '#b91c1c' }}>Could not load snapshots (HTTP {snapRes.status}).</p>
      ) : dates.length === 0 ? (
        <p style={{ color: muted }}>No snapshots for this period.</p>
      ) : (
        <>
          <SnapshotHistoryDataGrid
            rows={dates.flatMap((date) => {
              const group = byDate.get(date)!;
              return group.rows.map(
                (r): SnapshotHistoryGridRow => ({
                  id: r.id,
                  date,
                  entityName: r.entity?.name ?? r.entity?.code ?? '—',
                  billableCount: r.billableCount,
                  isLockedForBilling: r.isLockedForBilling,
                }),
              );
            })}
          />
          <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: muted, fontWeight: 600 }}>
            Days with data: {dates.length} · Peak day total:{' '}
            {Math.max(...dates.map((d) => byDate.get(d)!.total), 0)}
          </p>
        </>
      )}
    </main>
  );
}
