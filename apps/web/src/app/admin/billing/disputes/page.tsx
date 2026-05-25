import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import styles from '../../registration-requests/registration-requests.module.css';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const metadata: Metadata = {
  title: 'Platform billing disputes - UniCore',
};

type BillingDisputeRow = {
  id: string;
  status: string;
  reason: string;
  createdAt: string;
  institution: { id: string; name: string; slug: string };
  invoice: { id: string; amount: string; status: string; isRetroactive: boolean };
};

type SearchParams = {
  institutionId?: string;
};

function formatCurrency(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(numeric);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default async function SuperAdminBillingDisputesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const session = await auth();

  if (!session?.accessToken || !session.user) {
    redirect('/login?callbackUrl=/dashboard/admin/billing/disputes');
  }

  if (!session.user.permissions?.includes('*')) {
    return (
      <main className={styles.page}>
        <Link href="/dashboard" className={styles.breadcrumb}>
          ← Dashboard
        </Link>
        <h1 className={styles.title}>Billing disputes</h1>
        <p className={styles.subtitle} style={{ color: '#b91c1c' }}>
          Platform super administrator access required.
        </p>
      </main>
    );
  }

  const res = await fetch(`${apiBase}/super-admin/billing/disputes?limit=100`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });

  let rows: BillingDisputeRow[] = [];
  let fetchError: string | null = null;
  if (res.ok) {
    const payload = (await res.json()) as { data?: BillingDisputeRow[] };
    rows = payload.data ?? [];
  } else if (res.status === 401) {
    redirect('/login?callbackUrl=/dashboard/admin/billing/disputes');
  } else {
    fetchError = `Failed to load disputes (HTTP ${res.status})`;
  }

  const filteredRows = params.institutionId
    ? rows.filter((row) => row.institution.id === params.institutionId)
    : rows;

  return (
    <main className={styles.page}>
      <Link href="/dashboard/admin/billing" className={styles.breadcrumb}>
        ← Platform billing
      </Link>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Platform billing</p>
          <h1 className={styles.title}>Open disputes</h1>
          <p className={styles.subtitle}>
            Review disputes requiring platform attention across institutions.
          </p>
        </div>
        {params.institutionId ? (
          <Link href="/dashboard/admin/billing/disputes" className={styles.filterLink}>
            Clear institution filter
          </Link>
        ) : null}
      </header>

      <section className={styles.summaryStrip}>
        <SummaryCard label="Open" value={filteredRows.length} />
        <SummaryCard
          label="Manual review"
          value={filteredRows.filter((row) => row.status === 'MANUAL_REVIEW').length}
        />
        <SummaryCard
          label="Retroactive"
          value={filteredRows.filter((row) => row.invoice.isRetroactive).length}
        />
      </section>

      {fetchError ? (
        <p className={styles.subtitle} style={{ color: '#b91c1c' }}>
          {fetchError}
        </p>
      ) : null}

      <section className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Institution</th>
              <th>Status</th>
              <th>Invoice</th>
              <th>Reason</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <span className={styles.cellInstitution}>{row.institution.name}</span>
                  <span className={styles.cellEmail}>{row.institution.slug}</span>
                </td>
                <td>
                  <span className={`${styles.statusBadge} ${styles.statusPending}`}>
                    {row.status}
                  </span>
                </td>
                <td>
                  {formatCurrency(row.invoice.amount)}
                  <br />
                  <span className={styles.cellEmail}>{row.invoice.status}</span>
                </td>
                <td>{row.reason}</td>
                <td>{formatDate(row.createdAt)}</td>
                <td>
                  <Link
                    href={`/dashboard/admin/institutions/${encodeURIComponent(row.institution.id)}`}
                    className={styles.viewLink}
                  >
                    Institution
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 ? (
          <div className={styles.empty}>No open disputes found.</div>
        ) : null}
      </section>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className={styles.summaryCard}>
      <span className={styles.summaryLabel}>{label}</span>
      <strong className={styles.summaryValue}>{value.toLocaleString()}</strong>
    </article>
  );
}
