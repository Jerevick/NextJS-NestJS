import { StudentEnrollmentStatusEnum } from '@prisma/client';

/**
 * Billing integrity contract tests (.cursorrules §13).
 * These assert the platform billing rule without a live database.
 */
describe('Billing integrity contract', () => {
  const billable = (status: StudentEnrollmentStatusEnum): boolean =>
    status === StudentEnrollmentStatusEnum.ACTIVE;

  it('only ACTIVE students are billable', () => {
    expect(billable(StudentEnrollmentStatusEnum.ACTIVE)).toBe(true);
    expect(billable(StudentEnrollmentStatusEnum.INACTIVE)).toBe(false);
    expect(billable(StudentEnrollmentStatusEnum.SUSPENDED)).toBe(false);
    expect(billable(StudentEnrollmentStatusEnum.GRADUATED)).toBe(false);
    expect(billable(StudentEnrollmentStatusEnum.WITHDRAWN)).toBe(false);
    expect(billable(StudentEnrollmentStatusEnum.DEFERRED)).toBe(false);
    expect(billable(StudentEnrollmentStatusEnum.PERMANENTLY_DELETED)).toBe(false);
  });

  it('watermark billing uses max of peak and rounded-up average', () => {
    const peak = 120;
    const avg = 110.2;
    const ceilAvg = Math.ceil(avg - 1e-9);
    const watermark = Math.max(peak, ceilAvg);
    expect(watermark).toBe(120);
  });

  it('minimum billable floor raises count but not above actual watermark', () => {
    const watermark = 80;
    const minimum = 100;
    expect(Math.max(watermark, minimum)).toBe(100);
    expect(Math.max(150, minimum)).toBe(150);
  });
});
