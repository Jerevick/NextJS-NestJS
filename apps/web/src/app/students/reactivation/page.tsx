import Link from 'next/link';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { hasPermission } from '@/lib/permissions';
import {
  ReactivationRequestsDataGrid,
  type ReactivationGridRow,
} from '@/components/data-grids/misc-data-grids';
import { ReactivationRequestForm } from './reactivation-request-form';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

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

  const res = await fetch(`${apiBase}/reactivation-requests?limit=50`, {
    headers,
    cache: 'no-store',
  });
  const payload = res.ok
    ? ((await res.json()) as { data?: Row[]; total?: number })
    : { data: [], total: 0 };
  const rows = payload.data ?? [];
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
      <ReactivationRequestsDataGrid
        rows={rows.map(
          (r): ReactivationGridRow => ({
            id: r.id,
            status: r.status,
            studentLabel: `${r.student?.studentNumber ?? '—'} · ${r.student?.enrollmentStatus ?? '—'}`,
            campus: r.entity ? r.entity.code : '—',
            createdAt: r.createdAt,
          }),
        )}
      />
    </main>
  );
}
