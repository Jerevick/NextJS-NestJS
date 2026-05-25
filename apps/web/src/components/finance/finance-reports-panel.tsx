type AgingBucket = { label: string; count: number; total: number };

export function FinanceReportsPanel({
  aging,
  revenue,
  exportQuery = '',
}: {
  aging: { buckets: AgingBucket[]; accountCount: number } | null;
  exportQuery?: string;
  revenue: {
    from: string;
    to: string;
    transactionCount: number;
    byType: Record<string, number>;
    byMethod: Record<string, number>;
    byProgramme?: Array<{ programmeId: string; programmeName: string; total: number }>;
    byFeeType?: Array<{ feeCode: string; total: number }>;
  } | null;
}) {
  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <div>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: '#334155' }}>
          Aging (outstanding)
        </h3>
        {!aging ? (
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Could not load aging report.</p>
        ) : (
          <table style={{ width: '100%', fontSize: '0.88rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr
                style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}
              >
                <th style={{ padding: '0.4rem' }}>Bucket</th>
                <th style={{ padding: '0.4rem' }}>Accounts</th>
                <th style={{ padding: '0.4rem', textAlign: 'right' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {aging.buckets.map((b) => (
                <tr key={b.label} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.4rem' }}>{b.label}</td>
                  <td style={{ padding: '0.4rem' }}>{b.count}</td>
                  <td style={{ padding: '0.4rem', textAlign: 'right', fontWeight: 600 }}>
                    {b.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: '#334155' }}>
          Revenue (90 days)
        </h3>
        {!revenue ? (
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Could not load revenue report.</p>
        ) : (
          <>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: '#64748b' }}>
              {revenue.transactionCount} completed transactions
            </p>
            <p style={{ margin: '0 0 0.25rem', fontSize: '0.82rem', color: '#64748b' }}>By type</p>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.88rem', lineHeight: 1.6 }}>
              {Object.entries(revenue.byType).map(([type, sum]) => (
                <li key={type}>
                  {type}: {sum.toFixed(2)}
                </li>
              ))}
            </ul>
            {Object.keys(revenue.byMethod).length > 0 ? (
              <>
                <p style={{ margin: '0.75rem 0 0.25rem', fontSize: '0.82rem', color: '#64748b' }}>
                  By payment method
                </p>
                <ul
                  style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.88rem', lineHeight: 1.6 }}
                >
                  {Object.entries(revenue.byMethod).map(([method, sum]) => (
                    <li key={method}>
                      {method || 'unknown'}: {sum.toFixed(2)}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {revenue.byProgramme && revenue.byProgramme.length > 0 ? (
              <>
                <p style={{ margin: '0.75rem 0 0.25rem', fontSize: '0.82rem', color: '#64748b' }}>
                  By programme
                </p>
                <ul
                  style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.88rem', lineHeight: 1.6 }}
                >
                  {revenue.byProgramme.slice(0, 8).map((p) => (
                    <li key={p.programmeId}>
                      {p.programmeName}: {p.total.toFixed(2)}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {revenue.byFeeType && revenue.byFeeType.length > 0 ? (
              <>
                <p style={{ margin: '0.75rem 0 0.25rem', fontSize: '0.82rem', color: '#64748b' }}>
                  By fee type
                </p>
                <ul
                  style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.88rem', lineHeight: 1.6 }}
                >
                  {revenue.byFeeType.slice(0, 8).map((f) => (
                    <li key={f.feeCode}>
                      {f.feeCode}: {f.total.toFixed(2)}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            <p style={{ marginTop: '0.75rem', fontSize: '0.82rem' }}>
              <a
                href={`/dashboard/finance/reports/revenue/export.xlsx${exportQuery}`}
                style={{ color: '#0d9488', marginRight: 12 }}
              >
                Export Excel
              </a>
              <a
                href={`/dashboard/finance/reports/revenue/export.pdf${exportQuery}`}
                style={{ color: '#0d9488' }}
              >
                Export PDF
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
