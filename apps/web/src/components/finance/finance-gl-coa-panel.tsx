'use client';

import { useState, useTransition } from 'react';
import { setGlAccountActiveAction, upsertGlAccountAction } from '@/app/finance/actions';

type GlAccount = {
  id: string;
  code: string;
  name: string;
  type: string;
  normalBalance: string;
  isSystem: boolean;
  isActive: boolean;
};

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'REVENUE', 'EXPENSE'] as const;
const NORMAL_BALANCES = ['DEBIT', 'CREDIT'] as const;

export function FinanceGlCoaPanel({
  accounts,
  trialBalance,
  canWrite,
}: {
  accounts: GlAccount[];
  trialBalance: {
    accounts: Array<{ accountCode: string; totalDebit: number; totalCredit: number; net: number }>;
  } | null;
  canWrite: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('ASSET');
  const [normalBalance, setNormalBalance] = useState<string>('DEBIT');

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <div>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: '#334155' }}>
          Chart of accounts
        </h3>
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5 }}>
          Institution GL accounts used when posting journal lines from student transactions. System
          accounts are seeded on first use; custom accounts can be added by BURSAR.
        </p>
      </div>

      <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
            <th style={{ padding: '0.4rem' }}>Code</th>
            <th style={{ padding: '0.4rem' }}>Name</th>
            <th style={{ padding: '0.4rem' }}>Type</th>
            <th style={{ padding: '0.4rem' }}>Normal</th>
            <th style={{ padding: '0.4rem' }}>Active</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '0.4rem', fontFamily: 'monospace' }}>{a.code}</td>
              <td style={{ padding: '0.4rem' }}>
                {a.name}
                {a.isSystem ? (
                  <span style={{ marginLeft: 6, fontSize: '0.72rem', color: '#94a3b8' }}>
                    system
                  </span>
                ) : null}
              </td>
              <td style={{ padding: '0.4rem' }}>{a.type}</td>
              <td style={{ padding: '0.4rem' }}>{a.normalBalance}</td>
              <td style={{ padding: '0.4rem' }}>
                {canWrite ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setMessage(null);
                      startTransition(async () => {
                        const r = await setGlAccountActiveAction(a.id, !a.isActive);
                        setMessage(r.error ?? (a.isActive ? 'Deactivated.' : 'Activated.'));
                      });
                    }}
                    style={{
                      padding: '0.2rem 0.45rem',
                      fontSize: '0.75rem',
                      borderRadius: 6,
                      border: '1px solid #e2e8f0',
                      background: a.isActive ? '#ecfdf5' : '#f8fafc',
                      cursor: 'pointer',
                    }}
                  >
                    {a.isActive ? 'Yes' : 'No'}
                  </button>
                ) : a.isActive ? (
                  'Yes'
                ) : (
                  'No'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {trialBalance && trialBalance.accounts.length > 0 ? (
        <div>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: '#334155' }}>
            Trial balance (posted)
          </h3>
          <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr
                style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}
              >
                <th style={{ padding: '0.35rem' }}>Account</th>
                <th style={{ padding: '0.35rem', textAlign: 'right' }}>Debit</th>
                <th style={{ padding: '0.35rem', textAlign: 'right' }}>Credit</th>
                <th style={{ padding: '0.35rem', textAlign: 'right' }}>Net</th>
              </tr>
            </thead>
            <tbody>
              {trialBalance.accounts.map((row) => (
                <tr key={row.accountCode} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.35rem', fontFamily: 'monospace' }}>{row.accountCode}</td>
                  <td style={{ padding: '0.35rem', textAlign: 'right' }}>
                    {row.totalDebit.toFixed(2)}
                  </td>
                  <td style={{ padding: '0.35rem', textAlign: 'right' }}>
                    {row.totalCredit.toFixed(2)}
                  </td>
                  <td style={{ padding: '0.35rem', textAlign: 'right', fontWeight: 600 }}>
                    {row.net.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {canWrite ? (
        <form
          style={{
            display: 'grid',
            gap: 8,
            maxWidth: 480,
            paddingTop: 8,
            borderTop: '1px solid #f1f5f9',
          }}
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            startTransition(async () => {
              const r = await upsertGlAccountAction({
                code: code.trim(),
                name: name.trim(),
                type,
                normalBalance,
              });
              if (r.error) {
                setMessage(r.error);
              } else {
                setMessage('Account saved.');
                setCode('');
                setName('');
              }
            });
          }}
        >
          <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#334155' }}>Add custom account</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
              Code
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                placeholder="CUSTOM-FEE"
                style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
              Type
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
              Normal balance
              <select
                value={normalBalance}
                onChange={(e) => setNormalBalance(e.target.value)}
                style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
              >
                {NORMAL_BALANCES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={pending}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 8,
              border: 'none',
              background: '#1e3a5f',
              color: '#fff',
              fontWeight: 600,
              cursor: pending ? 'wait' : 'pointer',
              width: 'fit-content',
            }}
          >
            {pending ? 'Saving…' : 'Save account'}
          </button>
        </form>
      ) : null}

      {message ? (
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{message}</p>
      ) : null}
    </div>
  );
}
