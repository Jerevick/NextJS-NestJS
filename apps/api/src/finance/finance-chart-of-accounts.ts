import { FinanceTransactionType } from '@prisma/client';
import type { LedgerEntryLine } from './finance-ledger-entries.util';

/** Institution-default GL (metadata pairs; not a separate GL posting table). */
export const FINANCE_CHART_OF_ACCOUNTS_VERSION = 'unicore-finance-coa-v1';

export type ChartOfAccountEntry = {
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'REVENUE' | 'EXPENSE';
  normalBalance: 'DEBIT' | 'CREDIT';
};

export const INSTITUTION_DEFAULT_CHART_OF_ACCOUNTS: ChartOfAccountEntry[] = [
  { code: 'AR-STUDENT', name: 'Student receivables', type: 'ASSET', normalBalance: 'DEBIT' },
  { code: 'CASH-BANK', name: 'Cash — bank / gateway', type: 'ASSET', normalBalance: 'DEBIT' },
  {
    code: 'REVENUE-FEES',
    name: 'Tuition and fee revenue',
    type: 'REVENUE',
    normalBalance: 'CREDIT',
  },
  { code: 'WAIVERS-EXPENSE', name: 'Fee waivers', type: 'EXPENSE', normalBalance: 'DEBIT' },
  {
    code: 'SCHOLARSHIPS-EXPENSE',
    name: 'Scholarships awarded',
    type: 'EXPENSE',
    normalBalance: 'DEBIT',
  },
  { code: 'SUSPENSE', name: 'Finance suspense', type: 'LIABILITY', normalBalance: 'CREDIT' },
];

const COA_BY_CODE = new Map(INSTITUTION_DEFAULT_CHART_OF_ACCOUNTS.map((a) => [a.code, a]));

export function resolveChartAccount(code: string): ChartOfAccountEntry | undefined {
  return COA_BY_CODE.get(code);
}

export function listChartOfAccounts(): ChartOfAccountEntry[] {
  return [...INSTITUTION_DEFAULT_CHART_OF_ACCOUNTS];
}

export function ledgerLinesAreBalanced(lines: LedgerEntryLine[]): boolean {
  const debit = lines.reduce((s, l) => s + l.debit, 0);
  const credit = lines.reduce((s, l) => s + l.credit, 0);
  return Math.abs(debit - credit) < 0.005 && debit > 0;
}

/** Enriched metadata stored on FinanceTransaction.metadata. */
export function buildGlMetadataEnvelope(
  type: FinanceTransactionType,
  lines: LedgerEntryLine[],
): {
  ledgerEntries: Array<LedgerEntryLine & { accountName: string; accountType: string }>;
  gl: {
    chartVersion: string;
    transactionType: FinanceTransactionType;
    balanced: boolean;
    totalDebit: number;
    totalCredit: number;
  };
} {
  const enriched = lines.map((line) => {
    const acct = resolveChartAccount(line.account);
    return {
      ...line,
      accountName: acct?.name ?? line.account,
      accountType: acct?.type ?? 'ASSET',
    };
  });
  const totalDebit = enriched.reduce((s, l) => s + l.debit, 0);
  const totalCredit = enriched.reduce((s, l) => s + l.credit, 0);
  return {
    ledgerEntries: enriched,
    gl: {
      chartVersion: FINANCE_CHART_OF_ACCOUNTS_VERSION,
      transactionType: type,
      balanced: ledgerLinesAreBalanced(lines),
      totalDebit,
      totalCredit,
    },
  };
}
