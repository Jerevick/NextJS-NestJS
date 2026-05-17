import { FinanceTransactionType } from '@prisma/client';
import { buildLedgerEntries } from './finance-ledger-entries.util';

describe('buildLedgerEntries', () => {
  it('balances charges to revenue', () => {
    const lines = buildLedgerEntries(FinanceTransactionType.CHARGE, 100);
    expect(lines).toEqual([
      { account: 'AR-STUDENT', debit: 100, credit: 0 },
      { account: 'REVENUE-FEES', debit: 0, credit: 100 },
    ]);
  });

  it('balances payments to AR', () => {
    const lines = buildLedgerEntries(FinanceTransactionType.PAYMENT, -50);
    expect(lines[0].account).toBe('CASH-BANK');
    expect(lines[1].account).toBe('AR-STUDENT');
  });
});
