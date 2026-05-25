import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { StudentFinancePanel } from '@/components/finance/student-finance-panel';
import { StudentPayOnlineButton } from '@/components/finance/student-pay-online-button';
import { GUARDIAN_PORTAL } from '@/components/guardian-portal/guardian-portal-styles';
import { fetchPortalJson } from '@/lib/portal-api';

export default async function GuardianStudentFinancePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const session = await auth();
  if (!session?.accessToken) {
    redirect('/login');
  }
  if (session.user.role !== 'GUARDIAN') {
    redirect('/dashboard');
  }

  const summary = await fetchPortalJson<{
    visibility: { finance: boolean };
    student: { studentNumber: string; displayName: string };
  }>(`/portal/guardian/students/${encodeURIComponent(studentId)}`, session);

  if (summary.status === 404) {
    notFound();
  }

  if (!summary.ok || !summary.data.visibility.finance) {
    return (
      <>
        <Link
          href="/dashboard/guardian/dashboard"
          style={{ color: GUARDIAN_PORTAL.accent, textDecoration: 'none' }}
        >
          ← All students
        </Link>
        <p style={{ marginTop: '1rem', color: GUARDIAN_PORTAL.muted }}>
          Finance information is not available for guardians at this institution.
        </p>
      </>
    );
  }

  const finRes = await fetchPortalJson<{
    studentNumber: string;
    enrollmentStatus: string;
    account: { balance: number; currency: string; lastTransactionAt: string | null };
    transactions: Array<{
      id: string;
      type: string;
      amount: number;
      currency: string;
      description: string;
      reference: string;
      status: string;
      createdAt: string;
    }>;
  }>(`/portal/guardian/students/${encodeURIComponent(studentId)}/finance`, session);

  const payload = finRes.ok ? finRes.data : null;
  const error = finRes.ok ? null : `Could not load account (${finRes.status})`;
  const balance = payload?.account?.balance ?? 0;
  const currency = payload?.account?.currency ?? 'USD';

  return (
    <>
      <Link
        href="/dashboard/guardian/dashboard"
        style={{ color: GUARDIAN_PORTAL.accent, textDecoration: 'none' }}
      >
        ← All students
      </Link>
      <h1 style={{ margin: '0.75rem 0 0', fontSize: '1.4rem' }}>Pay on behalf</h1>
      <p style={{ color: GUARDIAN_PORTAL.muted }}>
        {summary.data.student.displayName} · #{summary.data.student.studentNumber}
      </p>

      <section
        style={{
          marginTop: '1.25rem',
          padding: '1.25rem',
          background: GUARDIAN_PORTAL.card,
          borderRadius: 12,
          border: `1px solid ${GUARDIAN_PORTAL.border}`,
        }}
      >
        <StudentFinancePanel payload={payload} error={error} />
        <StudentPayOnlineButton studentId={studentId} balance={balance} currency={currency} />
      </section>
    </>
  );
}
