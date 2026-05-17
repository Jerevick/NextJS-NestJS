import { FinanceTransactionType } from '@prisma/client';
import { buildLedgerMetadata } from './finance-ledger-entries.util';
import {
  FINANCE_CHART_OF_ACCOUNTS_VERSION,
  ledgerLinesAreBalanced,
  listChartOfAccounts,
} from './finance-chart-of-accounts';

describe('finance chart of accounts', () => {
  it('exposes institution default accounts', () => {
    const accounts = listChartOfAccounts();
    expect(accounts.length).toBeGreaterThanOrEqual(5);
    expect(accounts.some((a) => a.code === 'AR-STUDENT')).toBe(true);
  });

  it('buildLedgerMetadata is balanced and versioned', () => {
    const meta = buildLedgerMetadata(FinanceTransactionType.CHARGE, 250);
    expect(meta.gl.chartVersion).toBe(FINANCE_CHART_OF_ACCOUNTS_VERSION);
    expect(meta.gl.balanced).toBe(true);
    expect(ledgerLinesAreBalanced(meta.ledgerEntries)).toBe(true);
    expect(meta.ledgerEntries[0].accountName).toBeTruthy();
  });
});
