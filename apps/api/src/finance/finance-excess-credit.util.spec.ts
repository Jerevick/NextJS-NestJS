import { FinanceTransactionStatus, FinanceTransactionType } from '@prisma/client';
import {
  EXCESS_REQUEST_KIND,
  computeExcessCreditSummary,
  sumPendingExcessRequestAmounts,
  sumUnpaidInstallmentPrincipal,
} from './finance-excess-credit.util';

describe('computeExcessCreditSummary', () => {
  it('locks scholarship excess and only allows cash overpayment to be refunded', () => {
    const summary = computeExcessCreditSummary(
      [
        {
          type: FinanceTransactionType.CHARGE,
          amount: 1000,
          status: FinanceTransactionStatus.COMPLETED,
        },
        {
          type: FinanceTransactionType.SCHOLARSHIP_CREDIT,
          amount: -1500,
          status: FinanceTransactionStatus.COMPLETED,
        },
        {
          type: FinanceTransactionType.PAYMENT,
          amount: -200,
          status: FinanceTransactionStatus.COMPLETED,
        },
      ],
      0,
      0,
    );
    expect(summary.creditBalance).toBe(700);
    expect(summary.scholarshipLocked).toBe(500);
    expect(summary.cashTransferable).toBe(200);
    expect(summary.maxRefundable).toBe(200);
  });

  it('reserves unpaid installments and pending requests', () => {
    const summary = computeExcessCreditSummary(
      [
        {
          type: FinanceTransactionType.CHARGE,
          amount: 100,
          status: FinanceTransactionStatus.COMPLETED,
        },
        {
          type: FinanceTransactionType.PAYMENT,
          amount: -500,
          status: FinanceTransactionStatus.COMPLETED,
        },
      ],
      150,
      50,
    );
    expect(summary.cashTransferable).toBe(400);
    expect(summary.maxRefundable).toBe(200);
  });

  it('treats completed transfer-out as reducing cash pool', () => {
    const summary = computeExcessCreditSummary(
      [
        {
          type: FinanceTransactionType.PAYMENT,
          amount: -300,
          status: FinanceTransactionStatus.COMPLETED,
        },
        {
          type: FinanceTransactionType.ADJUSTMENT,
          amount: 80,
          status: FinanceTransactionStatus.COMPLETED,
          metadata: { requestKind: EXCESS_REQUEST_KIND.TRANSFER, transferOut: true },
        },
      ],
      0,
      0,
    );
    expect(summary.cashTransferable).toBe(220);
  });
});

describe('sumPendingExcessRequestAmounts', () => {
  it('sums only student excess pending rows', () => {
    const total = sumPendingExcessRequestAmounts([
      {
        type: FinanceTransactionType.REFUND,
        amount: -40,
        status: FinanceTransactionStatus.PENDING,
        metadata: { requestKind: EXCESS_REQUEST_KIND.REFUND },
      },
      {
        type: FinanceTransactionType.ADJUSTMENT,
        amount: 25,
        status: FinanceTransactionStatus.PENDING,
        metadata: { requestKind: EXCESS_REQUEST_KIND.TRANSFER },
      },
      {
        type: FinanceTransactionType.REFUND,
        amount: -10,
        status: FinanceTransactionStatus.PENDING,
        metadata: {},
      },
    ]);
    expect(total).toBe(65);
  });
});

describe('sumUnpaidInstallmentPrincipal', () => {
  it('sums remaining installment balances on active plans', () => {
    expect(
      sumUnpaidInstallmentPrincipal([
        {
          status: 'ACTIVE',
          installments: [
            { dueDate: '2026-06-01', amount: 100, paidAmount: 40, status: 'PENDING' },
            { dueDate: '2026-07-01', amount: 50, paidAmount: 50, status: 'PAID' },
          ],
        },
      ]),
    ).toBe(60);
  });
});
