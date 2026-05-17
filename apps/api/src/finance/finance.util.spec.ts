import { FinanceTransactionType } from '@prisma/client';
import { applyPaymentToInstallments, signedLedgerAmount } from './finance.util';

describe('signedLedgerAmount', () => {
  it('charges increase balance', () => {
    expect(signedLedgerAmount(FinanceTransactionType.CHARGE, 100)).toBe(100);
  });

  it('payments reduce balance', () => {
    expect(signedLedgerAmount(FinanceTransactionType.PAYMENT, 50)).toBe(-50);
  });
});

describe('applyPaymentToInstallments', () => {
  it('allocates payment to oldest pending installments first', () => {
    const { installments, applied } = applyPaymentToInstallments(
      [
        { dueDate: '2026-06-01', amount: 100, paidAmount: 0, status: 'PENDING' },
        { dueDate: '2026-07-01', amount: 50, paidAmount: 0, status: 'PENDING' },
      ],
      120,
    );
    expect(applied).toBe(120);
    expect(installments[0].status).toBe('PAID');
    expect(installments[0].paidAmount).toBe(100);
    expect(installments[1].paidAmount).toBe(20);
    expect(installments[1].status).toBe('PENDING');
  });
});
