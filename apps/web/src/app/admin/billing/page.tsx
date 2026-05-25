import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import styles from '../registration-requests/registration-requests.module.css';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const metadata: Metadata = {
  title: 'Platform billing - UniCore',
};

type PlatformOverview = {
  estimatedMrr: string;
  revenuePaidLast30Days: string;
  openDisputes: number;
  totalBillableStudents: number;
};

type MrrTrend = {
  months: Array<{ month: string; revenue: string; invoiceCount: number }>;
};

function formatCurrency(value: string | number): string {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return '$0';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(numeric);
}

export default async function SuperAdminBillingPage() {
  const session = await auth();

  if (!session?.accessToken || !session.user) {
    redirect('/login?callbackUrl=/dashboard/admin/billing');
  }

  if (!session.user.permissions?.includes('*')) {
    return (
      <main className={styles.page}>
        <Link href="/dashboard" className={styles.breadcrumb}>
          ← Dashboard
        </Link>
        <h1 className={styles.title}>Platform billing</h1>
        <p className={styles.subtitle} style={{ color: '#b91c1c' }}>
          Platform super administrator access required.
        </p>
      </main>
    );
  }

  const [overviewRes, trendRes] = await Promise.all([
    fetch(`${apiBase}/super-admin/overview`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: 'no-store',
    }),
    fetch(`${apiBase}/super-admin/overview/mrr-trend`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: 'no-store',
    }),
  ]);

  const overview = overviewRes.ok ? ((await overviewRes.json()) as PlatformOverview) : null;
  const trend = trendRes.ok ? ((await trendRes.json()) as MrrTrend).months : [];

  return (
    <main className={styles.page}>
      <Link href="/dashboard" className={styles.breadcrumb}>
        ← Dashboard
      </Link>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Platform billing</p>
          <h1 className={styles.title}>Revenue overview</h1>
          <p className={styles.subtitle}>
            Monitor estimated recurring revenue, paid revenue, disputes, and invoice trend signals.
          </p>
        </div>
        <Link href="/dashboard/admin/billing/disputes" className={styles.filterLinkActive}>
          Open disputes
        </Link>
      </header>

      <section className={styles.summaryStrip}>
        <SummaryCard
          label="Estimated MRR"
          value={overview ? formatCurrency(overview.estimatedMrr) : '—'}
        />
        <SummaryCard
          label="Paid 30 days"
          value={overview ? formatCurrency(overview.revenuePaidLast30Days) : '—'}
        />
        <SummaryCard
          label="Billable students"
          value={overview?.totalBillableStudents.toLocaleString() ?? '—'}
        />
        <SummaryCard label="Open disputes" value={overview?.openDisputes.toLocaleString() ?? '—'} />
      </section>

      <section className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Month</th>
              <th>Paid revenue</th>
              <th>Paid invoices</th>
            </tr>
          </thead>
          <tbody>
            {trend.map((month) => (
              <tr key={month.month}>
                <td>{month.month}</td>
                <td>{formatCurrency(month.revenue)}</td>
                <td>{month.invoiceCount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {trend.length === 0 ? (
          <div className={styles.empty}>No billing trend data available.</div>
        ) : null}
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className={styles.summaryCard}>
      <span className={styles.summaryLabel}>{label}</span>
      <strong className={styles.summaryValue}>{value}</strong>
    </article>
  );
}
