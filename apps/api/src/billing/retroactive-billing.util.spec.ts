import { Prisma } from '@prisma/client';
import { computeRetroactiveFeeAmount, inclusiveUtcCalendarDays } from './retroactive-billing.util';

describe('retroactive-billing.util', () => {
  it('counts inclusive UTC calendar days', () => {
    const from = new Date(Date.UTC(2025, 0, 1));
    const to = new Date(Date.UTC(2025, 0, 3));
    expect(inclusiveUtcCalendarDays(from, to)).toBe(3);
  });

  it('computes fee as days × (monthly unit / 30)', () => {
    const from = new Date(Date.UTC(2025, 0, 1));
    const to = new Date(Date.UTC(2025, 0, 10));
    const { inactiveDays, amount } = computeRetroactiveFeeAmount(
      from,
      to,
      new Prisma.Decimal('30.00'),
    );
    expect(inactiveDays).toBe(10);
    expect(amount.toFixed(2)).toBe('10.00');
  });
});
