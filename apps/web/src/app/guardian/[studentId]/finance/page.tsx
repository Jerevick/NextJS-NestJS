import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { StudentFinancePanel } from '@/components/finance/student-finance-panel';
import { StudentPayOnlineButton } from '@/components/finance/student-pay-online-button';
import { appendOptionalEntityHeader } from '@/lib/api-headers';
import { hasPermission } from '@/lib/permissions';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Guardian pay-on-behalf view (Phase 9 / 15). */
export default async function GuardianStudentFinancePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const session = await auth();
  if (!session?.accessToken) {
    redirect('/dashboard');
  }

  const isGuardian = session.user.role === 'GUARDIAN';
  const isStaffFinance =
    hasPermission(session.user.permissions, 'finance.read') ||
    hasPermission(session.user.permissions, 'finance.write');

  if (!isGuardian && !isStaffFinance) {
    return (
      <main style={{ padding: '2rem' }}>
        <p style={{ color: '#64748b' }}>You do not have access to this student&apos;s finance.</p>
      </main>
    );
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);

  const res = await fetch(`${apiBase}/finance/students/${encodeURIComponent(studentId)}/account`, {
    headers,
    cache: 'no-store',
  });

  if (res.status === 404) {
    notFound();
  }

  if (res.status === 403) {
    return (
      <main
        style={{ padding: '2rem 2.5rem', maxWidth: 720, minHeight: '100vh', background: '#f8fafc' }}
      >
        <Link
          href="/dashboard"
          style={{ color: '#2563eb', fontSize: '0.9rem', textDecoration: 'none' }}
        >
          ← Dashboard
        </Link>
        <h1 style={{ margin: '0.75rem 0 0', color: '#0f1729' }}>Pay on behalf</h1>
        <p style={{ marginTop: '1rem', color: '#64748b' }}>
          {isGuardian
            ? 'You are not linked as a guardian for this student. Contact the institution if this is incorrect.'
            : 'You do not have permission to view this student account.'}
        </p>
      </main>
    );
  }

  let payload = null;
  let error: string | null = null;
  if (res.ok) {
    payload = await res.json();
  } else {
    error = `Could not load account (${res.status})`;
  }

  const balance = payload?.account?.balance ?? 0;
  const currency = payload?.account?.currency ?? 'USD';

  return (
    <main
      style={{ padding: '2rem 2.5rem', maxWidth: 720, minHeight: '100vh', background: '#f8fafc' }}
    >
      <Link
        href="/dashboard"
        style={{ color: '#2563eb', fontSize: '0.9rem', textDecoration: 'none' }}
      >
        ← Dashboard
      </Link>
      <h1 style={{ margin: '0.75rem 0 0', color: '#0f1729' }}>Pay on behalf</h1>
      <p style={{ color: '#64748b', marginTop: '0.35rem' }}>
        Student #{payload?.studentNumber ?? studentId.slice(0, 8)}
      </p>

      <section
        style={{
          marginTop: '1.25rem',
          padding: '1.25rem',
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
        }}
      >
        <StudentFinancePanel payload={payload} error={error} />
        <StudentPayOnlineButton studentId={studentId} balance={balance} currency={currency} />
      </section>
    </main>
  );
}
