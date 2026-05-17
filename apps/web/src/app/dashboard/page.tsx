import Link from 'next/link';
import { auth } from '@/auth';
import type { ConsolidatedStatsPayload } from '@/components/entities/entities-dashboard';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { canAccessBillingNav, hasPermission } from '@/lib/permissions';

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default async function DashboardPage() {
  const session = await auth();

  let consolidated: ConsolidatedStatsPayload | null = null;
  if (session?.accessToken && session.user?.institutionId && session.user.entityScope === 'ALL') {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.accessToken}`,
      'X-Institution-ID': session.user.institutionId,
    };
    appendOptionalEntityHeader(headers, session.user);
    const res = await fetch(
      `${apiBase}/institutions/${session.user.institutionId}/entities/consolidated/stats`,
      { headers, cache: 'no-store' },
    );
    if (res.ok) {
      consolidated = (await res.json()) as ConsolidatedStatsPayload;
    }
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 960 }}>
      <h1>Dashboard</h1>
      <p>Signed in as {session?.user?.email}</p>
      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
        Role: {session?.user?.role} · Institution: {session?.user?.institutionId} · scope{' '}
        <strong>{session?.user?.entityScope}</strong>
      </p>

      {consolidated ? (
        <section
          style={{
            marginTop: '1.5rem',
            padding: '1.25rem',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            background: '#f8fafc',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Institution-wide headcount</h2>
          <p style={{ margin: '0.35rem 0 0', color: '#64748b', fontSize: '0.88rem' }}>
            Across {consolidated.entities.length} campus
            {consolidated.entities.length === 1 ? '' : 'es'}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginTop: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>
                Billable
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>
                {consolidated.institutionTotals.billableStudentCount.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Inactive</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 600 }}>
                {consolidated.institutionTotals.inactiveStudentCount.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Total students</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 600 }}>
                {consolidated.institutionTotals.totalStudentCount.toLocaleString()}
              </div>
            </div>
          </div>
          <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
            <Link href="/entities" style={{ color: '#2563eb', fontWeight: 600 }}>
              Manage campuses →
            </Link>
          </p>
        </section>
      ) : null}

      <nav style={{ marginTop: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Link href="/students" style={{ color: '#2563eb' }}>
          Students
        </Link>
        {session?.user && hasPermission(session.user.permissions, 'admissions.read') ? (
          <Link href="/admissions" style={{ color: '#2563eb' }}>
            Admissions
          </Link>
        ) : null}
        {session?.user &&
        (hasPermission(session.user.permissions, 'grades.enter') ||
          hasPermission(session.user.permissions, 'grades.write')) ? (
          <Link href="/grades/entry" style={{ color: '#2563eb' }}>
            Grade entry
          </Link>
        ) : null}
        {session?.user && hasPermission(session.user.permissions, 'grades.write') ? (
          <Link href="/settings/grading-weights" style={{ color: '#2563eb' }}>
            Grading weights
          </Link>
        ) : null}
        <Link href="/notifications" style={{ color: '#2563eb' }}>
          Notifications
        </Link>
        <Link href="/courses" style={{ color: '#2563eb' }}>
          Courses (LMS)
        </Link>
        <Link href="/entities" style={{ color: '#2563eb' }}>
          Campuses
        </Link>
        {session?.user?.permissions?.includes('*') ||
        session?.user?.permissions?.includes('org.read') ||
        session?.user?.permissions?.includes('institutions.write') ? (
          <Link href="/settings/org-structure" style={{ color: '#2563eb' }}>
            Org structure
          </Link>
        ) : null}
        {session?.user && canAccessBillingNav(session.user.permissions) ? (
          <Link href="/billing" style={{ color: '#2563eb' }}>
            Billing
          </Link>
        ) : null}
        {session?.user &&
        (canAccessBillingNav(session.user.permissions) ||
          hasPermission(session.user.permissions, 'finance.read') ||
          hasPermission(session.user.permissions, 'finance.write')) ? (
          <Link href="/finance" style={{ color: '#2563eb' }}>
            Finance
          </Link>
        ) : null}
        {session?.user && canAccessBillingNav(session.user.permissions) ? (
          <Link href="/billing/disputes" style={{ color: '#2563eb' }}>
            Billing disputes
          </Link>
        ) : null}
        {session?.user && hasPermission(session.user.permissions, 'students.read') ? (
          <Link href="/students/reactivation" style={{ color: '#2563eb' }}>
            Reactivation requests
          </Link>
        ) : null}
        {session?.user &&
        (hasPermission(session.user.permissions, 'progression.write') ||
          hasPermission(session.user.permissions, 'students.write')) ? (
          <Link href="/registrar/progression" style={{ color: '#2563eb' }}>
            Progression batch
          </Link>
        ) : null}
        <Link href="/workflow/inbox" style={{ color: '#2563eb' }}>
          Workflow inbox
        </Link>
        {session?.user?.entityScope === 'ALL' &&
        (session?.user?.permissions?.includes('*') ||
          session?.user?.permissions?.includes('institutions.write')) ? (
          <Link href="/entities/new" style={{ color: '#2563eb' }}>
            Add campus
          </Link>
        ) : null}
        {session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN' ? (
          <Link href="/admin" style={{ color: '#2563eb' }}>
            Admin
          </Link>
        ) : null}
      </nav>
    </main>
  );
}
