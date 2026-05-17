import { FinanceTransactionStatus, FinanceTransactionType } from '@prisma/client';
import type { PaymentPlanInstallmentRow } from './finance.util';
import { parsePaymentPlanInstallments } from './finance.util';

export const EXCESS_REQUEST_KIND = {
  REFUND: 'EXCESS_REFUND',
  TRANSFER: 'EXCESS_TRANSFER',
} as const;

export type ExcessRequestKind = (typeof EXCESS_REQUEST_KIND)[keyof typeof EXCESS_REQUEST_KIND];

export type LedgerRowForExcess = {
  type: FinanceTransactionType;
  amount: number;
  status: FinanceTransactionStatus;
  metadata?: unknown;
};

export type ExcessCreditSummary = {
  /** Signed ledger balance: positive = amount owed, negative = credit on account. */
  balance: number;
  creditBalance: number;
  scholarshipLocked: number;
  cashTransferable: number;
  reservedForPaymentPlans: number;
  pendingRequests: number;
  maxRefundable: number;
  maxTransferable: number;
};

function readRequestKind(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const kind = (metadata as Record<string, unknown>).requestKind;
  return typeof kind === 'string' ? kind : null;
}

function isTransferOutAdjustment(row: LedgerRowForExcess): boolean {
  if (row.type !== FinanceTransactionType.ADJUSTMENT || row.amount <= 0) {
    return false;
  }
  return (
    readRequestKind(row.metadata) === EXCESS_REQUEST_KIND.TRANSFER ||
    Boolean((row.metadata as Record<string, unknown> | undefined)?.transferOut)
  );
}

/** Unpaid installment principal remaining on active plans. */
export function sumUnpaidInstallmentPrincipal(
  plans: Array<{ status: string; installments: unknown }>,
): number {
  let total = 0;
  for (const plan of plans) {
    if (plan.status !== 'ACTIVE') {
      continue;
    }
    const installments = parsePaymentPlanInstallments(
      plan.installments,
    ) as PaymentPlanInstallmentRow[];
    for (const inst of installments) {
      if (inst.status === 'PAID') {
        continue;
      }
      total += Math.max(0, inst.amount - inst.paidAmount);
    }
  }
  return total;
}

/**
 * Cash paid (not scholarship) applied to charges first; remainder is refundable/transferable.
 * Scholarship credits are never refundable or transferable, including any excess after charges.
 */
export function computeExcessCreditSummary(
  rows: LedgerRowForExcess[],
  unpaidInstallments: number,
  pendingRequestTotal: number,
): ExcessCreditSummary {
  const completed = rows.filter((r) => r.status === FinanceTransactionStatus.COMPLETED);

  let charges = 0;
  let cashPaid = 0;
  let scholarship = 0;
  let waivers = 0;
  let refundsOut = 0;
  let transfersOut = 0;

  for (const row of completed) {
    const amt = row.amount;
    switch (row.type) {
      case FinanceTransactionType.CHARGE:
        if (amt > 0) {
          charges += amt;
        }
        break;
      case FinanceTransactionType.ADJUSTMENT:
        if (isTransferOutAdjustment(row)) {
          transfersOut += amt;
        } else if (amt > 0) {
          charges += amt;
        } else {
          cashPaid += Math.abs(amt);
        }
        break;
      case FinanceTransactionType.PAYMENT:
        cashPaid += Math.abs(amt);
        break;
      case FinanceTransactionType.SCHOLARSHIP_CREDIT:
        scholarship += Math.abs(amt);
        break;
      case FinanceTransactionType.WAIVER:
        waivers += Math.abs(amt);
        break;
      case FinanceTransactionType.REFUND:
        refundsOut += Math.abs(amt);
        break;
      default:
        break;
    }
  }

  const netCharges = Math.max(0, charges - waivers);
  const scholarshipApplied = Math.min(scholarship, netCharges);
  const chargesAfterScholarship = Math.max(0, netCharges - scholarshipApplied);
  const cashAppliedToCharges = Math.min(cashPaid, chargesAfterScholarship);
  const cashTransferable = Math.max(0, cashPaid - cashAppliedToCharges - refundsOut - transfersOut);
  const scholarshipLocked = Math.max(0, scholarship - scholarshipApplied);

  const balance = rows
    .filter((r) => r.status === FinanceTransactionStatus.COMPLETED)
    .reduce((sum, r) => sum + r.amount, 0);

  const creditBalance = Math.max(0, -balance);
  const reservedForPaymentPlans = unpaidInstallments;
  const maxRefundable = Math.max(
    0,
    cashTransferable - reservedForPaymentPlans - pendingRequestTotal,
  );
  const maxTransferable = maxRefundable;

  return {
    balance,
    creditBalance,
    scholarshipLocked,
    cashTransferable,
    reservedForPaymentPlans,
    pendingRequests: pendingRequestTotal,
    maxRefundable,
    maxTransferable,
  };
}

export function sumPendingExcessRequestAmounts(
  rows: Array<{
    type: FinanceTransactionType;
    amount: number;
    status: FinanceTransactionStatus;
    metadata?: unknown;
  }>,
): number {
  let total = 0;
  for (const row of rows) {
    if (row.status !== FinanceTransactionStatus.PENDING) {
      continue;
    }
    const kind = readRequestKind(row.metadata);
    if (row.type === FinanceTransactionType.REFUND && kind === EXCESS_REQUEST_KIND.REFUND) {
      total += Math.abs(row.amount);
    } else if (
      row.type === FinanceTransactionType.ADJUSTMENT &&
      kind === EXCESS_REQUEST_KIND.TRANSFER
    ) {
      total += Math.abs(row.amount);
    }
  }
  return total;
}
