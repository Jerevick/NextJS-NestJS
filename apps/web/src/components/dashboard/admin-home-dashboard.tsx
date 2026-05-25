import Link from 'next/link';
import { fetchDashboardJson } from '@/lib/dashboard-api';
import type { Session } from 'next-auth';
import styles from './admin-home-dashboard.module.css';

type AdminPayload = {
  entityScope: string;
  entity: { code: string; name: string; status: string } | null;
  institutionTotals: {
    billableStudentCount: number;
    inactiveStudentCount: number;
    totalStudentCount: number;
  } | null;
  entityStats: {
    activeStudents: number;
    totalStudents: number;
    staffCount: number;
    enrollmentsCurrentAcademicYear: number;
  } | null;
  campuses: Array<{ entityId: string; code: string; name: string; activeStudents: number }>;
  workflow: {
    pendingCount: number;
    preview: Array<{
      id: string;
      definitionName: string;
      dueAt: string;
      entityCode: string;
    }>;
  };
};

export async function AdminHomeDashboard({
  session,
}: {
  session: Session & { accessToken: string };
}) {
  const res = await fetchDashboardJson<AdminPayload>('/dashboard/admin', session);
  const isSuperAdmin =
    session.user.role === 'SUPER_ADMIN' || session.user.permissions?.includes('*');

  if (!res.ok) {
    return (
      <main className={styles.shell}>
        <section className={styles.errorState}>
          <p className={styles.eyebrow}>Dashboard unavailable</p>
          <h1>Could not load the admin dashboard</h1>
          <p>API returned status {res.status}. Refresh once the platform API is available.</p>
        </section>
      </main>
    );
  }

  const d = res.data;
  const institutionTotals = d.institutionTotals;
  const entityStats = d.entityStats;
  const activeCampuses = d.campuses.length;
  const totalCampusStudents = d.campuses.reduce((sum, campus) => sum + campus.activeStudents, 0);
  const scopeLabel = d.entity
    ? `${d.entity.name} (${d.entity.code})`
    : d.entityScope === 'ALL'
      ? 'All campuses'
      : `Scope: ${d.entityScope}`;
  const studentUtilization =
    institutionTotals && institutionTotals.totalStudentCount > 0
      ? Math.round(
          (institutionTotals.billableStudentCount / institutionTotals.totalStudentCount) * 100,
        )
      : null;

  const heroMetrics = [
    {
      label: 'Billable students',
      value: institutionTotals?.billableStudentCount ?? entityStats?.activeStudents ?? 0,
      helper: institutionTotals
        ? `${institutionTotals.totalStudentCount.toLocaleString()} total records`
        : 'Active in current scope',
      tone: 'blue',
    },
    {
      label: 'Workflow inbox',
      value: d.workflow.pendingCount,
      helper: d.workflow.pendingCount === 1 ? '1 item needs action' : 'Items needing action',
      tone: d.workflow.pendingCount > 0 ? 'amber' : 'green',
    },
    {
      label: isSuperAdmin ? 'Campus footprint' : 'Active campuses',
      value: activeCampuses || (d.entity ? 1 : 0),
      helper: activeCampuses
        ? `${totalCampusStudents.toLocaleString()} active students across campuses`
        : d.entity
          ? d.entity.status
          : 'No campuses available',
      tone: 'purple',
    },
    {
      label: 'Entity scope',
      value: d.entityScope,
      helper: isSuperAdmin ? 'Platform-wide permissions enabled' : 'Institution permission scope',
      tone: 'slate',
    },
  ] as const;

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>
            {isSuperAdmin ? 'Platform command center' : 'Institution command center'}
          </p>
          <h1>{isSuperAdmin ? 'Super admin dashboard' : 'Institution overview'}</h1>
          <p className={styles.heroText}>
            {scopeLabel}. Monitor operating health, review workflows, and jump into the tools that
            keep UniCore running smoothly.
          </p>
          <div className={styles.heroActions}>
            <Link
              href={
                isSuperAdmin
                  ? '/dashboard/admin/registration-requests'
                  : '/dashboard/workflow/inbox'
              }
              className={styles.primaryAction}
            >
              {isSuperAdmin ? 'Review onboarding queue' : 'Open workflow inbox'}
            </Link>
            <Link href="/dashboard/workflow/inbox" className={styles.secondaryAction}>
              Workflow inbox
            </Link>
          </div>
        </div>
        <aside className={styles.healthCard}>
          <span className={styles.healthPulse} aria-hidden />
          <p className={styles.healthLabel}>Session</p>
          <strong>{session.user.email}</strong>
          <span>{isSuperAdmin ? 'Super administrator' : 'Administrator'}</span>
        </aside>
      </section>

      <section className={styles.metricGrid} aria-label="Dashboard metrics">
        {heroMetrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            helper={metric.helper}
            tone={metric.tone}
          />
        ))}
      </section>

      {isSuperAdmin ? <SuperAdminCommandCards /> : null}

      <section className={styles.contentGrid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Enrollment</p>
              <h2>Institution-wide headcount</h2>
            </div>
            <Link href="/dashboard/entities" className={styles.panelLink}>
              Manage campuses
            </Link>
          </div>

          {institutionTotals ? (
            <>
              <div className={styles.headcountGrid}>
                <MiniStat label="Billable" value={institutionTotals.billableStudentCount} />
                <MiniStat label="Inactive" value={institutionTotals.inactiveStudentCount} />
                <MiniStat label="Total" value={institutionTotals.totalStudentCount} />
              </div>
              {studentUtilization !== null ? (
                <div className={styles.progressBlock}>
                  <div>
                    <span>Billable utilization</span>
                    <strong>{studentUtilization}%</strong>
                  </div>
                  <div className={styles.progressTrack}>
                    <span style={{ width: `${Math.min(studentUtilization, 100)}%` }} />
                  </div>
                </div>
              ) : null}
            </>
          ) : entityStats ? (
            <div className={styles.headcountGrid}>
              <MiniStat label="Active students" value={entityStats.activeStudents} />
              <MiniStat label="Staff" value={entityStats.staffCount} />
              <MiniStat label="AY enrollments" value={entityStats.enrollmentsCurrentAcademicYear} />
            </div>
          ) : (
            <EmptyState message="No headcount snapshot is available for this scope yet." />
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.eyebrow}>Operations</p>
              <h2>Workflow inbox</h2>
            </div>
            <Link href="/dashboard/workflow/inbox" className={styles.panelLink}>
              View all
            </Link>
          </div>

          {d.workflow.preview.length > 0 ? (
            <div className={styles.workflowList}>
              {d.workflow.preview.map((w) => (
                <Link href="/dashboard/workflow/inbox" className={styles.workflowItem} key={w.id}>
                  <span>
                    <strong>{w.definitionName}</strong>
                    <small>
                      {w.entityCode} · due {formatDateTime(w.dueAt)}
                    </small>
                  </span>
                  <b>Open</b>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState message="No pending workflows. Everything is clear." />
          )}
        </section>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>Campus portfolio</p>
            <h2>Campuses and active students</h2>
          </div>
          <Link href="/dashboard/entities/new" className={styles.panelLink}>
            Add campus
          </Link>
        </div>

        {d.campuses.length > 0 ? (
          <div className={styles.campusGrid}>
            {d.campuses.map((campus) => (
              <article className={styles.campusCard} key={campus.entityId}>
                <span>{campus.code}</span>
                <strong>{campus.name}</strong>
                <p>{campus.activeStudents.toLocaleString()} active students</p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState message="No campus portfolio data is available yet." />
        )}
      </section>

      <nav className={styles.quickNav} aria-label="Dashboard navigation">
        <Link href="/dashboard/students">Students</Link>
        <Link href="/dashboard/settings">Settings</Link>
        <Link href="/dashboard/finance">Finance</Link>
        <Link href="/dashboard/admissions">Admissions</Link>
        <Link href="/dashboard/admin/ai-intelligence">AI intelligence</Link>
      </nav>
    </main>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: number | string;
  helper: string;
  tone: 'blue' | 'amber' | 'green' | 'purple' | 'slate';
}) {
  return (
    <section className={styles.metricCard} data-tone={tone}>
      <span>{label}</span>
      <strong>{typeof value === 'number' ? value.toLocaleString() : value}</strong>
      <p>{helper}</p>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.miniStat}>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className={styles.emptyState}>{message}</p>;
}

function SuperAdminCommandCards() {
  const cards = [
    {
      title: 'Institution onboarding',
      body: 'Review new registration requests, approve dossiers, and trigger next-step emails.',
      href: '/dashboard/admin/registration-requests',
      cta: 'Open queue',
    },
    {
      title: 'Platform intelligence',
      body: 'Use AI-generated operating narratives for anomalies, dropout risk, and billing signals.',
      href: '/dashboard/admin/ai-intelligence',
      cta: 'View intelligence',
    },
    {
      title: 'Provision institution',
      body: 'Create a tenant, prepare modules, and hand off first administrator access.',
      href: '/dashboard/admin/institutions/new',
      cta: 'Provision tenant',
    },
  ];

  return (
    <section className={styles.commandGrid} aria-label="Super admin command cards">
      {cards.map((card) => (
        <Link href={card.href} className={styles.commandCard} key={card.title}>
          <span className={styles.eyebrow}>Super admin</span>
          <strong>{card.title}</strong>
          <p>{card.body}</p>
          <b>{card.cta} →</b>
        </Link>
      ))}
    </section>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
