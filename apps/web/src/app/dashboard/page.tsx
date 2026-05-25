import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AdminHomeDashboard } from '@/components/dashboard/admin-home-dashboard';
import styles from '@/components/dashboard/admin-home-dashboard.module.css';
import { FacultyHomeDashboard } from '@/components/dashboard/faculty-home-dashboard';
import { StaffHomeDashboard } from '@/components/dashboard/staff-home-dashboard';
import type { RegistrationRequestRow } from '@/app/admin/registration-requests/types';
import { StudentDashboardWrapper } from './student-dashboard-wrapper';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type PlatformOverview = {
  totalInstitutions: number;
  totalBillableStudents: number;
  openDisputes: number;
  estimatedMrr: string;
  revenuePaidLast30Days: string;
  platformHealthScore: number;
  anomalies: Array<{ institutionId: string; name: string; dropPct: number }>;
  institutionsByStatus: { active: number; trial: number; suspended: number };
};

type PlatformSessions = {
  totalOnline: number;
  byInstitution: Array<{ institutionId: string; name: string; online: number }>;
  asOf: string;
};

type MrrTrend = {
  months: Array<{ month: string; revenue: string; invoiceCount: number }>;
};

type SuperAdminJson<T> = { ok: true; data: T } | { ok: false; status: number };

async function fetchSuperAdminJson<T>(
  path: string,
  accessToken: string,
): Promise<SuperAdminJson<T>> {
  try {
    const res = await fetch(`${apiBase}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      return { ok: false, status: res.status };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function SuperAdminDashboard({
  accessToken,
  email,
}: {
  accessToken: string;
  email?: string | null;
}) {
  const [overviewRes, sessionsRes, trendRes, requestsRes] = await Promise.all([
    fetchSuperAdminJson<PlatformOverview>('/super-admin/overview', accessToken),
    fetchSuperAdminJson<PlatformSessions>('/super-admin/overview/active-sessions', accessToken),
    fetchSuperAdminJson<MrrTrend>('/super-admin/overview/mrr-trend', accessToken),
    fetchSuperAdminJson<{ data?: RegistrationRequestRow[] }>(
      '/super-admin/registration-requests?status=PENDING&limit=50',
      accessToken,
    ),
  ]);

  const overview = overviewRes.ok ? overviewRes.data : null;
  const sessions = sessionsRes.ok ? sessionsRes.data : null;
  const trend = trendRes.ok ? trendRes.data.months : [];
  const pendingRequests = requestsRes.ok ? (requestsRes.data.data ?? []) : [];
  const latestRequests = pendingRequests.slice(0, 5);
  const maxRevenue = Math.max(...trend.map((m) => Number(m.revenue)), 0);

  const metrics = [
    {
      label: 'Institutions',
      value: overview?.totalInstitutions ?? 'Unavailable',
      helper: overview
        ? `${overview.institutionsByStatus.active} active / ${overview.institutionsByStatus.trial} trial / ${overview.institutionsByStatus.suspended} suspended`
        : 'Platform overview did not load',
      tone: 'blue',
      href: '/dashboard/admin/institutions',
    },
    {
      label: 'Billable students',
      value: overview?.totalBillableStudents ?? 'Unavailable',
      helper: 'Aggregated tenant enrollment footprint',
      tone: 'purple',
      href: '/dashboard/admin/institutions',
    },
    {
      label: 'Estimated MRR',
      value: overview ? formatCurrency(overview.estimatedMrr) : 'Unavailable',
      helper: overview
        ? `${formatCurrency(overview.revenuePaidLast30Days)} paid in last 30 days`
        : 'Billing snapshot unavailable',
      tone: 'green',
      href: '/dashboard/admin/billing',
    },
    {
      label: 'Active sessions',
      value: sessions?.totalOnline ?? 'Unavailable',
      helper: sessions
        ? `Last updated ${formatDateTime(sessions.asOf)}`
        : 'Session telemetry unavailable',
      tone: 'amber',
      href: '/dashboard/admin/institutions',
    },
  ] as const;

  const cards = [
    {
      title: 'Registration requests',
      body: 'Review onboarding dossiers, mark decisions, and move approved schools to provisioning.',
      href: '/dashboard/admin/registration-requests',
      cta: 'Open queue',
    },
    {
      title: 'Institution portfolio',
      body: 'Open tenant health, billing, entity, module, and operational snapshots.',
      href: '/dashboard/admin/institutions',
      cta: 'View institutions',
    },
    {
      title: 'Provision institution',
      body: 'Create a tenant, enable modules, configure billing, and issue the first admin handoff.',
      href: '/dashboard/admin/institutions/new',
      cta: 'Provision tenant',
    },
    {
      title: 'Billing center',
      body: 'Review MRR, paid revenue trend, and billing disputes needing platform attention.',
      href: '/dashboard/admin/billing',
      cta: 'Open billing',
    },
  ];

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Platform command center</p>
          <h1>Super admin dashboard</h1>
          <p className={styles.heroText}>
            Monitor tenant health, onboarding velocity, billing signals, and platform session
            activity without crossing into institution-owned student management.
          </p>
          <div className={styles.heroActions}>
            <Link href="/dashboard/admin/registration-requests" className={styles.primaryAction}>
              Review onboarding queue
            </Link>
            <Link href="/dashboard/admin/institutions/new" className={styles.secondaryAction}>
              Provision institution
            </Link>
          </div>
        </div>
        <aside className={styles.healthCard}>
          <span className={styles.healthPulse} aria-hidden />
          <p className={styles.healthLabel}>Platform health</p>
          <strong>{overview ? `${overview.platformHealthScore}%` : 'Unavailable'}</strong>
          <span>{email ? `Signed in as ${email}` : 'Super administrator'}</span>
        </aside>
      </section>

      <section className={styles.metricGrid} aria-label="Platform metrics">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className={styles.commandGrid} aria-label="Super admin actions">
        {cards.map((card) => (
          <Link href={card.href} className={styles.commandCard} key={card.title}>
            <span className={styles.eyebrow}>Super admin</span>
            <strong>{card.title}</strong>
            <p>{card.body}</p>
            <b>{card.cta}</b>
          </Link>
        ))}
      </section>

      <section className={styles.contentGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Onboarding</p>
              <h2>Pending institution requests</h2>
            </div>
            <Link href="/dashboard/admin/registration-requests" className={styles.panelLink}>
              View all
            </Link>
          </div>

          <div className={styles.headcountGrid}>
            <MiniStat label="Pending" value={pendingRequests.length} />
            <MiniStat
              label="Open disputes"
              value={overview?.openDisputes ?? 0}
              href="/dashboard/admin/billing/disputes"
            />
            <MiniStat
              label="Anomalies"
              value={overview?.anomalies.length ?? 0}
              href="/dashboard/admin/institutions"
            />
          </div>

          {latestRequests.length > 0 ? (
            <div className={styles.workflowList}>
              {latestRequests.map((request) => (
                <Link
                  href={`/dashboard/admin/registration-requests/${request.id}`}
                  className={styles.workflowItem}
                  key={request.id}
                >
                  <span>
                    <strong>{request.payload.institutionName ?? request.email}</strong>
                    <small>
                      {formatKind(request.kind)} / submitted {formatDateTime(request.createdAt)}
                    </small>
                  </span>
                  <b>Review</b>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState message="No pending onboarding requests right now." />
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Live platform</p>
              <h2>Active tenant sessions</h2>
            </div>
            <span className={styles.panelLink}>{sessions?.totalOnline ?? 0} online</span>
          </div>

          {sessions && sessions.byInstitution.length > 0 ? (
            <div className={styles.workflowList}>
              {sessions.byInstitution.slice(0, 5).map((row) => (
                <Link
                  href={`/dashboard/admin/institutions/${encodeURIComponent(row.institutionId)}`}
                  className={styles.workflowItem}
                  key={row.institutionId}
                >
                  <span>
                    <strong>{row.name}</strong>
                    <small>
                      {row.online === 1 ? '1 active user' : `${row.online} active users`}
                    </small>
                  </span>
                  <b>Open</b>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState message="No active tenant sessions in the last 15 minutes." />
          )}
        </section>
      </section>

      <section className={styles.platformInsightStack}>
        <section className={`${styles.panel} ${styles.revenuePanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Revenue</p>
              <h2>Paid revenue trend</h2>
            </div>
            <span className={styles.panelLink}>12 months</span>
          </div>

          {trend.length > 0 ? (
            <div className={`${styles.horizontalInsightGrid} ${styles.revenueTrendGrid}`}>
              {trend.slice(-6).map((month) => {
                const revenue = Number(month.revenue);
                const width = maxRevenue > 0 ? Math.max((revenue / maxRevenue) * 100, 4) : 4;
                return (
                  <Link
                    href="/dashboard/admin/billing"
                    className={`${styles.progressBlock} ${styles.horizontalInsightCard}`}
                    key={month.month}
                  >
                    <div>
                      <span>{month.month}</span>
                      <strong>{formatCurrency(month.revenue)}</strong>
                    </div>
                    <div className={styles.progressTrack}>
                      <span style={{ width: `${width}%` }} />
                    </div>
                    <p>{month.invoiceCount} paid invoices</p>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState message="No revenue trend is available yet." />
          )}
        </section>

        <section className={`${styles.panel} ${styles.riskPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Risk signals</p>
              <h2>Institution health anomalies</h2>
            </div>
            <span className={styles.panelLink}>{overview?.anomalies.length ?? 0} flagged</span>
          </div>

          {overview && overview.anomalies.length > 0 ? (
            <div className={`${styles.horizontalInsightGrid} ${styles.riskSignalGrid}`}>
              {overview.anomalies.slice(0, 5).map((row) => (
                <Link
                  href={`/dashboard/admin/institutions/${encodeURIComponent(row.institutionId)}`}
                  className={`${styles.workflowItem} ${styles.riskSignalCard}`}
                  key={row.institutionId}
                >
                  <span>
                    <strong>{row.name}</strong>
                    <small>{Math.round(row.dropPct)}% billing snapshot drop detected</small>
                  </span>
                  <b>Open</b>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState message="No institution health anomalies are currently flagged." />
          )}
        </section>
      </section>
    </main>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone,
  href,
}: {
  label: string;
  value: number | string;
  helper: string;
  tone: 'blue' | 'amber' | 'green' | 'purple' | 'slate';
  href?: string;
}) {
  const content = (
    <>
      <span>{label}</span>
      <strong>{typeof value === 'number' ? value.toLocaleString() : value}</strong>
      <p>{helper}</p>
    </>
  );

  return href ? (
    <Link href={href} className={styles.metricCard} data-tone={tone}>
      {content}
    </Link>
  ) : (
    <section className={styles.metricCard} data-tone={tone}>
      {content}
    </section>
  );
}

function MiniStat({ label, value, href }: { label: string; value: number; href?: string }) {
  const content = (
    <>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </>
  );

  return href ? (
    <Link href={href} className={styles.miniStat}>
      {content}
    </Link>
  ) : (
    <div className={styles.miniStat}>{content}</div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className={styles.emptyState}>{message}</p>;
}

function formatKind(kind: RegistrationRequestRow['kind']): string {
  return kind === 'NEW_INSTITUTION' ? 'New institution' : 'Join institution';
}

function formatCurrency(value: string | number): string {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return '$0';
  }
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(numeric);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.accessToken) {
    redirect('/login');
  }

  const role = session.user?.role;
  const authed = session as typeof session & { accessToken: string };

  if (role === 'GUARDIAN') {
    redirect('/dashboard/guardian/dashboard');
  }

  if (role === 'ALUMNI') {
    redirect('/dashboard/alumni/home');
  }

  if (role === 'STUDENT' && session.user.studentId) {
    return <StudentDashboardWrapper />;
  }

  if (role === 'FACULTY') {
    return <FacultyHomeDashboard session={authed} />;
  }

  if (role === 'STAFF') {
    return <StaffHomeDashboard session={authed} />;
  }

  if (role === 'SUPER_ADMIN') {
    return <SuperAdminDashboard accessToken={session.accessToken} email={session.user.email} />;
  }

  if (role === 'ADMIN') {
    return <AdminHomeDashboard session={authed} />;
  }

  redirect('/login');
}
