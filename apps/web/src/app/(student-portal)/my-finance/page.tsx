import { auth } from '@/auth';
import { StudentFinancePanel } from '@/components/finance/student-finance-panel';
import { StudentPayOnlineButton } from '@/components/finance/student-pay-online-button';
import { StudentExcessCreditPanel } from '@/components/finance/student-excess-credit-panel';
import { StudentPortalPageHeader } from '@/components/student-portal/student-portal-page-header';
import { STUDENT_PORTAL } from '@/components/student-portal/student-portal-styles';
import { fetchPortalJson } from '@/lib/portal-api';

type FinancePayload = {
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
};

type ExcessPayload = {
  balance: number;
  creditBalance: number;
  scholarshipLocked: number;
  cashTransferable: number;
  reservedForPaymentPlans: number;
  pendingRequests: number;
  maxRefundable: number;
  maxTransferable: number;
  currency: string;
};

export default async function MyFinancePage() {
  const session = await auth();
  const studentId = session?.user?.studentId;
  if (!session?.accessToken || !studentId) {
    return null;
  }

  const [finRes, profileRes, excessRes] = await Promise.all([
    fetchPortalJson<FinancePayload>('/portal/student/finance', session),
    fetchPortalJson<{ readOnly: boolean }>('/portal/student/profile', session),
    fetchPortalJson<ExcessPayload>('/portal/student/finance/excess-credit', session),
  ]);

  const payload = finRes.ok ? finRes.data : null;
  const error = finRes.ok ? null : `Could not load account (${finRes.status})`;
  const readOnly = profileRes.ok ? profileRes.data.readOnly : false;
  const excessSummary = excessRes.ok ? excessRes.data : null;

  const balance = payload?.account?.balance ?? 0;
  const currency = payload?.account?.currency ?? 'USD';

  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: 720 }}>
      <StudentPortalPageHeader
        title="My finance"
        description="View balance, pay online, manage excess credit, and download receipts."
      />

      <section
        style={{
          marginTop: '0.5rem',
          padding: '1.25rem',
          background: '#fff',
          borderRadius: 12,
          border: `1px solid ${STUDENT_PORTAL.border}`,
        }}
      >
        <StudentFinancePanel
          payload={payload}
          error={error}
          studentId={studentId}
          showReceiptLinks
        />
        {!readOnly ? (
          <StudentPayOnlineButton studentId={studentId} balance={balance} currency={currency} />
        ) : (
          <p style={{ color: STUDENT_PORTAL.muted, fontSize: '0.9rem' }}>
            Online payments are disabled while your enrollment is inactive.
          </p>
        )}
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
      </section>
    </div>
  );
}
