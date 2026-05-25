import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/auth';
import styles from '../../registration-requests/registration-requests.module.css';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const metadata: Metadata = {
  title: 'Institution detail - UniCore',
};

type InstitutionDetail = {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  plan: string;
  status: string;
  maxStudents: number | null;
  currentStudentCount: number | null;
  minimumBillableCount: number | null;
  billingDayOfMonth: number | null;
  disputeWindowDays: number | null;
  modules: Array<{ module: string; enabled: boolean }>;
  createdAt: string;
  updatedAt: string;
  health: {
    healthScore: number;
    billableStudents?: number;
    activeStudents?: number;
    openDisputes?: number;
    activeModules?: string[];
  };
  entities: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
    status: string;
    activeStudentCount: number | null;
  }>;
  subscription: {
    id: string;
    planId: string;
    billingCycle: string;
    amount: string;
    currency: string;
  } | null;
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatCurrency(value: string, currency = 'USD'): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(numeric);
}

function formatNumber(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : '—';
}

function formatDayOfMonth(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `Day ${value}` : '—';
}

function formatDays(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value} days` : '—';
}

export default async function SuperAdminInstitutionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (!session?.accessToken || !session.user) {
    redirect(`/login?callbackUrl=/dashboard/admin/institutions/${encodeURIComponent(id)}`);
  }

  if (!session.user.permissions?.includes('*')) {
    return (
      <main className={styles.page}>
        <Link href="/dashboard/admin/institutions" className={styles.breadcrumb}>
          ← Institutions
        </Link>
        <h1 className={styles.title}>Institution detail</h1>
        <p className={styles.subtitle} style={{ color: '#b91c1c' }}>
          Platform super administrator access required.
        </p>
      </main>
    );
  }

  const res = await fetch(`${apiBase}/super-admin/institutions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });

  if (res.status === 404) {
    notFound();
  }
  if (res.status === 401) {
    redirect(`/login?callbackUrl=/dashboard/admin/institutions/${encodeURIComponent(id)}`);
  }
  if (!res.ok) {
    return (
      <main className={styles.page}>
        <Link href="/dashboard/admin/institutions" className={styles.breadcrumb}>
          ← Institutions
        </Link>
        <h1 className={styles.title}>Institution detail</h1>
        <p className={styles.subtitle} style={{ color: '#b91c1c' }}>
          Failed to load institution (HTTP {res.status}).
        </p>
      </main>
    );
  }

  const detail = (await res.json()) as InstitutionDetail;
  const enabledModules = detail.modules.filter((m) => m.enabled).map((m) => m.module);
  const activeStudentCount = detail.entities.reduce(
    (sum, entity) => sum + (entity.activeStudentCount ?? 0),
    0,
  );
  const billableStudents = detail.health.billableStudents ?? detail.currentStudentCount ?? 0;
  const activeStudents = detail.health.activeStudents ?? activeStudentCount;
  const openDisputes = detail.health.openDisputes ?? 0;
  const activeModules = detail.health.activeModules ?? enabledModules;

  return (
    <main className={styles.page}>
      <Link href="/dashboard/admin/institutions" className={styles.breadcrumb}>
        ← Institutions
      </Link>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Institution detail</p>
          <h1 className={styles.title}>{detail.name}</h1>
          <p className={styles.subtitle}>
            {detail.slug} / {detail.domain ?? 'no domain'} / created {formatDate(detail.createdAt)}
          </p>
        </div>
        <Link
          href={`/dashboard/admin/billing/disputes?institutionId=${encodeURIComponent(detail.id)}`}
          className={styles.filterLinkActive}
        >
          View disputes
        </Link>
      </header>

      <section className={styles.summaryStrip}>
        <SummaryCard label="Health" value={`${detail.health.healthScore}%`} />
        <SummaryCard label="Students" value={formatNumber(detail.currentStudentCount)} />
        <SummaryCard label="Entities" value={detail.entities.length.toLocaleString()} />
        <SummaryCard label="Disputes" value={openDisputes.toLocaleString()} />
      </section>

      <section className={styles.detailGrid}>
        <div className={styles.detailColumn}>
          <section className={styles.detailCard}>
            <h2 className={styles.detailCardTitle}>Billing</h2>
            <dl className={styles.fieldList}>
              <Field label="Plan" value={detail.plan} />
              <Field label="Max students" value={formatNumber(detail.maxStudents)} />
              <Field label="Minimum billable" value={formatNumber(detail.minimumBillableCount)} />
              <Field label="Billing day" value={formatDayOfMonth(detail.billingDayOfMonth)} />
              <Field label="Dispute window" value={formatDays(detail.disputeWindowDays)} />
              <Field
                label="Subscription"
                value={
                  detail.subscription
                    ? `${formatCurrency(detail.subscription.amount, detail.subscription.currency)} / ${detail.subscription.billingCycle}`
                    : 'No subscription'
                }
              />
            </dl>
          </section>

          <section className={styles.detailCard}>
            <h2 className={styles.detailCardTitle}>Entities</h2>
            <div className={styles.tableCard}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Active students</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.entities.map((entity) => (
                    <tr key={entity.id}>
                      <td>{entity.code}</td>
                      <td>{entity.name}</td>
                      <td>{entity.type}</td>
                      <td>{entity.status}</td>
                      <td>{formatNumber(entity.activeStudentCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {detail.entities.length === 0 ? (
                <div className={styles.empty}>No entities found.</div>
              ) : null}
            </div>
          </section>
        </div>

        <aside className={styles.detailColumn}>
          <section className={styles.detailCard}>
            <h2 className={styles.detailCardTitle}>Health snapshot</h2>
            <dl className={styles.fieldList}>
              <Field label="Billable students" value={billableStudents.toLocaleString()} />
              <Field label="Active students" value={activeStudents.toLocaleString()} />
              <Field label="Open disputes" value={openDisputes.toLocaleString()} />
              <Field
                label="Active modules"
                value={activeModules.length ? activeModules.join(', ') : 'None'}
              />
            </dl>
          </section>

          <section className={styles.detailCard}>
            <h2 className={styles.detailCardTitle}>Modules</h2>
            <p className={styles.subtitle} style={{ margin: 0 }}>
              {enabledModules.length ? enabledModules.join(', ') : 'No enabled modules'}
            </p>
          </section>
        </aside>
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.fieldRow}>
      <dt className={styles.fieldLabel}>{label}</dt>
      <dd className={styles.fieldValue}>{value}</dd>
    </div>
  );
}
