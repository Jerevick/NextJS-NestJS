import { leaveBalanceAvailable, leaveDurationDays } from './staff-leave.util';

describe('staff-leave.util', () => {
  it('computes inclusive calendar days', () => {
    expect(
      leaveDurationDays(new Date('2026-05-01T12:00:00Z'), new Date('2026-05-03T08:00:00Z')),
    ).toBe(3);
  });

  it('computes available balance', () => {
    expect(leaveBalanceAvailable({ allocated: 20, used: 5, pending: 3, carriedOver: 2 })).toBe(14);
  });
});
