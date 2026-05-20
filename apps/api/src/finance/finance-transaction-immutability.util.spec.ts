import { BadRequestException } from '@nestjs/common';
import { assertFinanceTransactionUpdateAllowed } from './finance-transaction-immutability.util';

describe('finance-transaction-immutability.util', () => {
  it('allows pending transaction updates', () => {
    expect(() =>
      assertFinanceTransactionUpdateAllowed(
        { status: 'PENDING' },
        { amount: { set: 10 } as never },
      ),
    ).not.toThrow();
  });

  it('blocks amount changes on completed transactions', () => {
    expect(() =>
      assertFinanceTransactionUpdateAllowed(
        { status: 'COMPLETED' },
        { amount: { set: 10 } as never },
      ),
    ).toThrow(BadRequestException);
  });
});
