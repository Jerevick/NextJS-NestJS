import { FinanceTransactionType } from '@prisma/client';
import { randomUUID } from 'node:crypto';

/** Signed ledger amount: positive increases amount owed, negative reduces balance. */
export function signedLedgerAmount(type: FinanceTransactionType, absoluteAmount: number): number {
  const n = Math.abs(absoluteAmount);
  switch (type) {
    case 'PAYMENT':
    case 'SCHOLARSHIP_CREDIT':
    case 'REFUND':
    case 'WAIVER':
      return -n;
    case 'CHARGE':
    case 'ADJUSTMENT':
    default:
      return n;
  }
}

export function newFinanceReference(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export type FeeStructureItemRow = {
  code: string;
  name: string;
  amount: number;
  mandatory?: boolean;
  billedAt?: string;
};

export type PaymentPlanInstallmentRow = {
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
};

export function buildPaymentPlanInstallments(
  rows: Array<{ dueDate: string; amount: number }>,
): PaymentPlanInstallmentRow[] {
  const now = new Date();
  return rows.map((r) => {
    const due = new Date(r.dueDate);
    const status: PaymentPlanInstallmentRow['status'] = due < now ? 'OVERDUE' : 'PENDING';
    return {
      dueDate: r.dueDate,
      amount: r.amount,
      paidAmount: 0,
      status,
    };
  });
}

export function parsePaymentPlanInstallments(raw: unknown): PaymentPlanInstallmentRow[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: PaymentPlanInstallmentRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    if (typeof o.dueDate !== 'string' || typeof o.amount !== 'number') continue;
    out.push({
      dueDate: o.dueDate,
      amount: o.amount,
      paidAmount: typeof o.paidAmount === 'number' ? o.paidAmount : 0,
      status:
        o.status === 'PAID' || o.status === 'OVERDUE' || o.status === 'PENDING'
          ? o.status
          : 'PENDING',
    });
  }
  return out;
}

/** Allocate a payment amount across active plan installments (oldest due first). */
export function applyPaymentToInstallments(
  installments: PaymentPlanInstallmentRow[],
  paymentAmount: number,
): { installments: PaymentPlanInstallmentRow[]; applied: number } {
  let remaining = Math.max(0, paymentAmount);
  let applied = 0;
  const sorted = [...installments].sort(
    (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
  );
  for (const inst of sorted) {
    if (remaining <= 0 || inst.status === 'PAID') {
      continue;
    }
    const owed = inst.amount - inst.paidAmount;
    if (owed <= 0) {
      inst.status = 'PAID';
      continue;
    }
    const pay = Math.min(remaining, owed);
    inst.paidAmount += pay;
    remaining -= pay;
    applied += pay;
    if (inst.paidAmount >= inst.amount - 0.001) {
      inst.paidAmount = inst.amount;
      inst.status = 'PAID';
    }
  }
  return { installments: sorted, applied };
}

/** Extract fee item code from enrollment charge reference `ENR-{enrollmentId}-{code}`. */
export function feeCodeFromChargeReference(reference: string): string | null {
  const m = /^ENR-[^-]+-(.+)$/.exec(reference);
  return m?.[1] ?? null;
}

export function parseFeeStructureItems(raw: unknown): FeeStructureItemRow[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: FeeStructureItemRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const code = typeof o.code === 'string' ? o.code.trim() : '';
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    const amount = typeof o.amount === 'number' ? o.amount : Number(o.amount);
    if (!code || !name || !Number.isFinite(amount) || amount < 0) continue;
    out.push({
      code,
      name,
      amount,
      mandatory: o.mandatory === true,
      billedAt: typeof o.billedAt === 'string' ? o.billedAt : undefined,
    });
  }
  return out;
}
