import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { StudentFinancePanel } from '@/components/finance/student-finance-panel';
import { StudentPayOnlineButton } from '@/components/finance/student-pay-online-button';
import { StudentExcessCreditPanel } from '@/components/finance/student-excess-credit-panel';
import { StudentScholarshipApply } from '@/components/finance/student-scholarship-apply';
import { appendOptionalEntityHeader } from '@/lib/api-headers';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Student portal — personal finance (Phase 9 / 15). */
export default async function MyFinancePage() {
  const session = await auth();
  const studentId = session?.user?.studentId;
  if (!session?.accessToken || !studentId) {
    redirect('/dashboard');
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

  let payload = null;
  let error: string | null = null;
  if (res.ok) {
    payload = await res.json();
  } else {
    error = `Could not load account (${res.status})`;
  }

  const balance = payload?.account?.balance ?? 0;
  const currency = payload?.account?.currency ?? 'USD';

  const scholarshipsRes = await fetch(`${apiBase}/finance/scholarships`, {
    headers,
    cache: 'no-store',
  });
  const scholarshipsPayload = scholarshipsRes.ok
    ? ((await scholarshipsRes.json()) as {
        data?: Array<{ id: string; name: string; type: string }>;
      })
    : null;
  const scholarships = scholarshipsPayload?.data ?? [];

  const excessRes = await fetch(
    `${apiBase}/finance/students/${encodeURIComponent(studentId)}/excess-credit`,
    { headers, cache: 'no-store' },
  );
  const excessSummary = excessRes.ok
    ? ((await excessRes.json()) as {
        currency: string;
        balance: number;
        creditBalance: number;
        scholarshipLocked: number;
        cashTransferable: number;
        reservedForPaymentPlans: number;
        pendingRequests: number;
        maxRefundable: number;
        maxTransferable: number;
      })
    : null;

  return (
    <main
      style={{
        padding: '2rem 2.5rem',
        maxWidth: 720,
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f0fdfa 0%, #f8fafc 40%)',
      }}
    >
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem' }}>
        <Link href="/dashboard" style={{ color: '#0d9488', textDecoration: 'none' }}>
          ← Dashboard
        </Link>
        <Link href="/notifications" style={{ color: '#0d9488', textDecoration: 'none' }}>
          Notifications
        </Link>
      </div>
      <h1 style={{ margin: '0.75rem 0 0', color: '#0f1729', fontSize: '1.75rem' }}>My finance</h1>
      <p style={{ color: '#64748b', marginTop: '0.35rem' }}>
        View your balance, pay online, and download receipts.
      </p>

      <section
        style={{
          marginTop: '1.5rem',
          padding: '1.25rem',
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
        }}
      >
        <StudentFinancePanel
          payload={payload}
          error={error}
          studentId={studentId}
          showReceiptLinks
        />
        <StudentPayOnlineButton studentId={studentId} balance={balance} currency={currency} />
        <StudentExcessCreditPanel
          studentId={studentId}
          summary={
            excessSummary
              ? {
                  balance: excessSummary.balance,
                  creditBalance: excessSummary.creditBalance,
                  scholarshipLocked: excessSummary.scholarshipLocked,
                  cashTransferable: excessSummary.cashTransferable,
                  reservedForPaymentPlans: excessSummary.reservedForPaymentPlans,
                  pendingRequests: excessSummary.pendingRequests,
                  maxRefundable: excessSummary.maxRefundable,
                  maxTransferable: excessSummary.maxTransferable,
                  currency: excessSummary.currency,
                }
              : null
          }
        />
        <StudentScholarshipApply
          scholarships={scholarships}
          apiBase={apiBase}
          accessToken={session.accessToken}
          institutionId={session.user.institutionId}
          entityId={session.user.entityId}
        />
      </section>
    </main>
  );
}
