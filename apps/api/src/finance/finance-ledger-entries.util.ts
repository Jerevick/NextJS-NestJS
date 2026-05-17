import { FinanceTransactionType } from '@prisma/client';
import { buildGlMetadataEnvelope, ledgerLinesAreBalanced } from './finance-chart-of-accounts';

export type LedgerEntryLine = {
  account: string;
  debit: number;
  credit: number;
};

export type LedgerMetadataPayload = ReturnType<typeof buildGlMetadataEnvelope>;

/** Simplified double-entry pairs stored on FinanceTransaction.metadata. */
export function buildLedgerEntries(
  type: FinanceTransactionType,
  signedAmount: number,
  options?: { transferOut?: boolean },
): LedgerEntryLine[] {
  const amount = Math.abs(signedAmount);
  switch (type) {
    case FinanceTransactionType.CHARGE:
      return [
        { account: 'AR-STUDENT', debit: amount, credit: 0 },
        { account: 'REVENUE-FEES', debit: 0, credit: amount },
      ];
    case FinanceTransactionType.ADJUSTMENT:
      if (options?.transferOut) {
        return [
          { account: 'AR-STUDENT', debit: amount, credit: 0 },
          { account: 'CASH-BANK', debit: 0, credit: amount },
        ];
      }
      return [
        { account: 'AR-STUDENT', debit: amount, credit: 0 },
        { account: 'REVENUE-FEES', debit: 0, credit: amount },
      ];
    case FinanceTransactionType.PAYMENT:
      return [
        { account: 'CASH-BANK', debit: amount, credit: 0 },
        { account: 'AR-STUDENT', debit: 0, credit: amount },
      ];
    case FinanceTransactionType.WAIVER:
      return [
        { account: 'WAIVERS-EXPENSE', debit: amount, credit: 0 },
        { account: 'AR-STUDENT', debit: 0, credit: amount },
      ];
    case FinanceTransactionType.REFUND:
      return [
        { account: 'AR-STUDENT', debit: amount, credit: 0 },
        { account: 'CASH-BANK', debit: 0, credit: amount },
      ];
    case FinanceTransactionType.SCHOLARSHIP_CREDIT:
      return [
        { account: 'SCHOLARSHIPS-EXPENSE', debit: amount, credit: 0 },
        { account: 'AR-STUDENT', debit: 0, credit: amount },
      ];
    default:
      return [
        {
          account: 'AR-STUDENT',
          debit: signedAmount > 0 ? amount : 0,
          credit: signedAmount < 0 ? amount : 0,
        },
        {
          account: 'SUSPENSE',
          debit: signedAmount < 0 ? amount : 0,
          credit: signedAmount > 0 ? amount : 0,
        },
      ];
  }
}

/** Balanced GL metadata envelope for FinanceTransaction.metadata (not a separate GL book). */
export function buildLedgerMetadata(
  type: FinanceTransactionType,
  signedAmount: number,
  options?: { transferOut?: boolean },
): LedgerMetadataPayload {
  const lines = buildLedgerEntries(type, signedAmount, options);
  if (!ledgerLinesAreBalanced(lines)) {
    throw new Error(`Unbalanced ledger lines for ${type}`);
  }
  return buildGlMetadataEnvelope(type, lines);
}
