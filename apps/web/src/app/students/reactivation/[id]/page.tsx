import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { hasPermission } from '@/lib/permissions';
import { ReactivationReviewForms } from '../reactivation-review-forms';

const apiBase = process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type Detail = {
  id: string;
  status: string;
  justification: string;
  reviewNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
  studentId: string;
  student?: { studentNumber: string; enrollmentStatus: string };
  entity?: { code: string; name: string };
};

export default async function ReactivationRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const res = await fetch(`${apiBase}/reactivation-requests/${encodeURIComponent(id)}`, {
    headers,
    cache: 'no-store',
  });
  if (res.status === 404) {
    notFound();
  }
  if (!res.ok) {
    const body = await res.text();
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <Link href="/students/reactivation">← List</Link>
        <p style={{ color: '#b91c1c' }}>HTTP {res.status}</p>
        <pre style={{ fontSize: 12 }}>{body}</pre>
      </main>
    );
  }

  const r = (await res.json()) as Detail;
  const mono = { fontFamily: 'ui-monospace, monospace' } as const;
  const canReview = hasPermission(session.user.permissions, 'students.reactivate');
  const isPending = r.status === 'PENDING';

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 720 }}>
      <nav style={{ marginBottom: '1rem' }}>
        <Link href="/students/reactivation" style={{ color: '#2563eb' }}>
          ← Reactivation requests
        </Link>
        {' · '}
        <Link href={`/students/${encodeURIComponent(r.studentId)}`} style={{ color: '#2563eb' }}>
          Student profile
        </Link>
      </nav>
      <h1 style={{ marginTop: 0 }}>Reactivation request</h1>
      <p style={mono}>{r.id}</p>
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: '160px 1fr',
          gap: '0.5rem 1rem',
          fontSize: '0.92rem',
        }}
      >
        <dt style={{ color: '#64748b' }}>Status</dt>
        <dd style={{ margin: 0, fontWeight: 700 }}>{r.status}</dd>
        <dt style={{ color: '#64748b' }}>Student</dt>
        <dd style={{ margin: 0 }}>
          {r.student ? (
            <>
              <span style={mono}>{r.student.studentNumber}</span> · {r.student.enrollmentStatus}
            </>
          ) : (
            '—'
          )}
        </dd>
        <dt style={{ color: '#64748b' }}>Campus</dt>
        <dd style={{ margin: 0 }}>{r.entity ? `${r.entity.code} — ${r.entity.name}` : '—'}</dd>
        <dt style={{ color: '#64748b' }}>Justification</dt>
        <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{r.justification}</dd>
        <dt style={{ color: '#64748b' }}>Review notes</dt>
        <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{r.reviewNotes ?? '—'}</dd>
        <dt style={{ color: '#64748b' }}>Reviewed at</dt>
        <dd style={{ margin: 0, ...mono }}>{r.reviewedAt?.slice(0, 19) ?? '—'}</dd>
      </dl>

      <ReactivationReviewForms requestId={r.id} canReview={canReview} isPending={isPending} />
    </main>
  );
}
