type FinanceTxn = {
  id: string;
  type: string;
  amount: number;
  currency: string;
  description: string;
  reference: string;
  status: string;
  createdAt: string;
};

export function StudentFinancePanel({
  payload,
  error = null,
  studentId,
  showReceiptLinks = false,
}: {
  payload: {
    studentNumber: string;
    enrollmentStatus: string;
    account: { balance: number; currency: string; lastTransactionAt: string | null };
    transactions: FinanceTxn[];
  } | null;
  error?: string | null;
  studentId?: string;
  showReceiptLinks?: boolean;
}) {
  if (error) {
    return <p style={{ color: '#b91c1c' }}>{error}</p>;
  }
  if (!payload) {
    return <p style={{ color: '#64748b' }}>No financial data.</p>;
  }

  const bal = payload.account.balance;
  const owes = bal > 0;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            background: owes ? '#fff7ed' : '#ecfdf5',
            minWidth: 180,
          }}
        >
          <p
            style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}
          >
            Balance
          </p>
          <p
            style={{
              margin: '0.35rem 0 0',
              fontSize: '1.75rem',
              fontWeight: 700,
              color: '#0f1729',
            }}
          >
            {payload.account.currency}{' '}
            {bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
            {owes ? 'Amount outstanding' : bal < 0 ? 'Credit balance' : 'Settled'}
          </p>
        </div>
        <div style={{ fontSize: '0.85rem', color: '#64748b', alignSelf: 'center' }}>
          Student #{payload.studentNumber} · {payload.enrollmentStatus}
          {payload.account.lastTransactionAt ? (
            <>
              <br />
              Last activity · {new Date(payload.account.lastTransactionAt).toLocaleString()}
            </>
          ) : null}
        </div>
      </div>

      <h3 style={{ fontSize: '1rem', margin: '0 0 0.65rem', color: '#334155' }}>
        Recent ledger entries
      </h3>
      {payload.transactions.length <= 0 ? (
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No transactions yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
              <th style={{ padding: '0.5rem 0.35rem' }}>Date</th>
              <th style={{ padding: '0.5rem 0.35rem' }}>Type</th>
              <th style={{ padding: '0.5rem 0.35rem' }}>Description</th>
              <th style={{ padding: '0.5rem 0.35rem', textAlign: 'right' }}>Amount</th>
              {showReceiptLinks && studentId ? (
                <th style={{ padding: '0.5rem 0.35rem' }}>Receipt</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {payload.transactions.map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.45rem 0.35rem', whiteSpace: 'nowrap' }}>
                  {new Date(t.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: '0.45rem 0.35rem' }}>{t.type}</td>
                <td style={{ padding: '0.45rem 0.35rem' }}>{t.description}</td>
                <td
                  style={{
                    padding: '0.45rem 0.35rem',
                    textAlign: 'right',
                    fontWeight: 600,
                    color: t.amount > 0 ? '#b45309' : '#15803d',
                  }}
                >
                  {t.amount > 0 ? '+' : ''}
                  {t.amount.toFixed(2)} {t.currency}
                </td>
                {showReceiptLinks && studentId && t.status === 'COMPLETED' ? (
                  <td style={{ padding: '0.45rem 0.35rem' }}>
                    <a
                      href={`/dashboard/finance/receipts/${encodeURIComponent(studentId)}/${encodeURIComponent(t.id)}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#2563eb', fontSize: '0.8rem' }}
                    >
                      PDF
                    </a>
                  </td>
                ) : showReceiptLinks && studentId ? (
                  <td />
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
