import Link from 'next/link';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
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
        <Link href="/billing" style={{ color: primary }}>
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
        This is your institution&apos;s daily active student count as computed by UniCore. These numbers form the
        basis of your invoice.
      </p>

      <form method="get" style={{ display: 'flex', gap: '0.75rem', margin: '1.25rem 0', alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
          Year
          <input name="year" type="number" defaultValue={year} min={2020} max={2100} style={{ padding: '0.4rem' }} />
        </label>
        <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
          Month
          <input name="month" type="number" defaultValue={month} min={1} max={12} style={{ padding: '0.4rem' }} />
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
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e2e8f0', color: muted }}>
              <th style={{ padding: '0.5rem 0' }}>Date</th>
              <th style={{ padding: '0.5rem 0' }}>Entity</th>
              <th style={{ padding: '0.5rem 0' }}>Billable count</th>
              <th style={{ padding: '0.5rem 0' }}>Locked</th>
            </tr>
          </thead>
          <tbody>
            {dates.flatMap((date) => {
              const group = byDate.get(date)!;
              return group.rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.45rem 0', fontFamily: 'ui-monospace, monospace' }}>{date}</td>
                  <td style={{ padding: '0.45rem 0' }}>{r.entity?.name ?? r.entity?.code ?? '—'}</td>
                  <td style={{ padding: '0.45rem 0', fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
                    {r.billableCount}
                  </td>
                  <td style={{ padding: '0.45rem 0' }}>{r.isLockedForBilling ? 'Yes' : '—'}</td>
                </tr>
              ));
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #e2e8f0', fontWeight: 600 }}>
              <td colSpan={2} style={{ padding: '0.5rem 0' }}>
                Days with data: {dates.length}
              </td>
              <td colSpan={2} style={{ padding: '0.5rem 0', fontFamily: 'ui-monospace, monospace' }}>
                Peak day total: {Math.max(...dates.map((d) => byDate.get(d)!.total), 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </main>
  );
}
