import Link from 'next/link';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { hasPermission } from '@/lib/permissions';
import { ReactivationRequestForm } from './reactivation-request-form';

const apiBase = process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type Row = {
  id: string;
  studentId: string;
  status: string;
  createdAt: string;
  student?: { studentNumber: string; enrollmentStatus: string };
  entity?: { code: string; name: string };
};

export default async function ReactivationRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const { studentId: studentIdFromQuery } = await searchParams;
  const session = await auth();
  if (!session?.accessToken || !session.user?.institutionId) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <p>Sign in.</p>
        <Link href="/login">Login</Link>
      </main>
    );
  }
  if (!hasPermission(session.user.permissions, 'students.read')) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <p>You need students.read.</p>
        <Link href="/dashboard">Dashboard</Link>
      </main>
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);

  const res = await fetch(`${apiBase}/reactivation-requests?limit=50`, { headers, cache: 'no-store' });
  const payload = res.ok ? ((await res.json()) as { data?: Row[]; total?: number }) : { data: [], total: 0 };
  const rows = payload.data ?? [];
  const mono = { fontFamily: 'ui-monospace, monospace' } as const;
  const canWrite = hasPermission(session.user.permissions, 'students.write');

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 960 }}>
      <nav style={{ marginBottom: '1rem' }}>
        <Link href="/students" style={{ color: '#2563eb' }}>
          ← Students
        </Link>
      </nav>
      <h1 style={{ marginTop: 0 }}>Reactivation requests</h1>
      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Total: {payload.total ?? rows.length}</p>

      {canWrite ? (
        <ReactivationRequestForm defaultStudentId={studentIdFromQuery?.trim() || undefined} />
      ) : null}

      {!res.ok ? <p style={{ color: '#b91c1c' }}>Could not load ({res.status}).</p> : null}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '0.5rem' }}>Status</th>
              <th style={{ padding: '0.5rem' }}>Student</th>
              <th style={{ padding: '0.5rem' }}>Campus</th>
              <th style={{ padding: '0.5rem' }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.5rem' }}>{r.status}</td>
                <td style={{ padding: '0.5rem', ...mono }}>
                  {r.student?.studentNumber ?? '—'} · {r.student?.enrollmentStatus ?? '—'}
                </td>
                <td style={{ padding: '0.5rem' }}>{r.entity ? `${r.entity.code}` : '—'}</td>
                <td style={{ padding: '0.5rem', ...mono }}>
                  <Link href={`/students/reactivation/${encodeURIComponent(r.id)}`} style={{ color: '#2563eb' }}>
                    {r.createdAt?.slice(0, 19)}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
