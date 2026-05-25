import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import styles from '../registration-requests/registration-requests.module.css';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const metadata: Metadata = {
  title: 'Institution portfolio - UniCore',
};

type InstitutionRow = {
  id: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
  currentStudentCount: number;
  entityCount: number;
  openDisputes: number;
  healthScore: number;
  anomalyAlert: boolean;
  createdAt: string;
};

type SearchParams = {
  status?: string;
  search?: string;
};

function statusClass(status: string): string {
  if (status === 'ACTIVE') return styles.statusProvisioned;
  if (status === 'TRIAL') return styles.statusReviewed;
  if (status === 'SUSPENDED') return styles.statusPending;
  return styles.statusDismissed;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export default async function SuperAdminInstitutionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const session = await auth();

  if (!session?.accessToken || !session.user) {
    redirect('/login?callbackUrl=/dashboard/admin/institutions');
  }

  if (!session.user.permissions?.includes('*')) {
    return (
      <main className={styles.page}>
        <Link href="/dashboard" className={styles.breadcrumb}>
          ← Dashboard
        </Link>
        <h1 className={styles.title}>Institution portfolio</h1>
        <p className={styles.subtitle} style={{ color: '#b91c1c' }}>
          Platform super administrator access required.
        </p>
      </main>
    );
  }

  const qs = new URLSearchParams({ limit: '100' });
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);

  const res = await fetch(`${apiBase}/super-admin/institutions?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });

  let rows: InstitutionRow[] = [];
  let total = 0;
  let fetchError: string | null = null;
  if (res.ok) {
    const payload = (await res.json()) as { data?: InstitutionRow[]; total?: number };
    rows = payload.data ?? [];
    total = payload.total ?? rows.length;
  } else if (res.status === 401) {
    redirect('/login?callbackUrl=/dashboard/admin/institutions');
  } else {
    fetchError = `Failed to load institutions (HTTP ${res.status})`;
  }

  const active = rows.filter((r) => r.status === 'ACTIVE').length;
  const suspended = rows.filter((r) => r.status === 'SUSPENDED').length;
  const anomalies = rows.filter((r) => r.anomalyAlert).length;

  return (
    <main className={styles.page}>
      <Link href="/dashboard" className={styles.breadcrumb}>
        ← Dashboard
      </Link>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Platform portfolio</p>
          <h1 className={styles.title}>Institutions</h1>
          <p className={styles.subtitle}>
            Review tenant status, health, disputes, entities, and billable student footprint.
          </p>
        </div>
        <Link href="/dashboard/admin/institutions/new" className={styles.filterLinkActive}>
          Provision institution
        </Link>
      </header>

      <section className={styles.summaryStrip}>
        <SummaryCard label="Total" value={total} />
        <SummaryCard label="Active" value={active} />
        <SummaryCard label="Suspended" value={suspended} />
        <SummaryCard label="Anomalies" value={anomalies} />
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
              <th>Plan</th>
              <th>Students</th>
              <th>Health</th>
              <th>Disputes</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <span className={styles.cellInstitution}>{row.name}</span>
                  <span className={styles.cellEmail}>{row.slug}</span>
                </td>
                <td>
                  <span className={`${styles.statusBadge} ${statusClass(row.status)}`}>
                    {row.status}
                  </span>
                </td>
                <td>{row.plan}</td>
                <td>{row.currentStudentCount.toLocaleString()}</td>
                <td>
                  {row.healthScore}%{row.anomalyAlert ? ' / flagged' : ''}
                </td>
                <td>{row.openDisputes.toLocaleString()}</td>
                <td>{formatDate(row.createdAt)}</td>
                <td>
                  <Link
                    href={`/dashboard/admin/institutions/${row.id}`}
                    className={styles.viewLink}
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <div className={styles.empty}>No institutions found.</div> : null}
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
