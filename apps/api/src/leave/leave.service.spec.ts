import { leaveBalanceAvailable, leaveDurationDays } from '../staff/staff-leave.util';

describe('LeaveService entitlement helpers', () => {
  it('rejects when requested days exceed available balance', () => {
    const balance = { allocated: 10, used: 2, pending: 3, carriedOver: 1 };
    const available = leaveBalanceAvailable(balance);
    const requested = leaveDurationDays(
      new Date('2026-06-01T00:00:00Z'),
      new Date('2026-06-10T00:00:00Z'),
    );
    expect(requested).toBe(10);
    expect(available).toBe(6);
    expect(requested > available).toBe(true);
  });

  it('allows request when balance covers inclusive duration', () => {
    const balance = { allocated: 20, used: 0, pending: 0, carriedOver: 0 };
    const requested = leaveDurationDays(
      new Date('2026-07-01T12:00:00Z'),
      new Date('2026-07-05T08:00:00Z'),
    );
    expect(requested).toBe(5);
    expect(requested <= leaveBalanceAvailable(balance)).toBe(true);
  });
});
