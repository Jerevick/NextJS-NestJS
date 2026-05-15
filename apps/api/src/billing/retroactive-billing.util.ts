import { Prisma } from '@prisma/client';

const MS_PER_UTC_DAY = 86_400_000;

/** Inclusive UTC calendar days between from and to (minimum 1). */
export function inclusiveUtcCalendarDays(from: Date, to: Date): number {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  if (end < start) {
    return 0;
  }
  return Math.floor((end - start) / MS_PER_UTC_DAY) + 1;
}

/**
 * Retroactive backfill fee: inactive calendar days × (monthly unit ÷ 30).
 * Aligns with “full inactive period billed” — one student-day per day in the window.
 */
export function computeRetroactiveFeeAmount(
  from: Date,
  to: Date,
  monthlyUnit: Prisma.Decimal,
): { inactiveDays: number; amount: Prisma.Decimal; dailyRate: Prisma.Decimal } {
  const inactiveDays = inclusiveUtcCalendarDays(from, to);
  const dailyRate = monthlyUnit.div(30);
  const amount = dailyRate.mul(inactiveDays);
  return { inactiveDays, amount, dailyRate };
}
