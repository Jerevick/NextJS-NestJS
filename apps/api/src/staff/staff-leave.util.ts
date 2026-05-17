/** Calendar-day span inclusive of start and end (UTC date parts). */
export function leaveDurationDays(start: Date, end: Date): number {
  const s = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const e = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.max(1, Math.floor((e - s) / 86_400_000) + 1);
}

export function leaveBalanceAvailable(balance: {
  allocated: number;
  used: number;
  pending: number;
  carriedOver: number;
}): number {
  return balance.allocated + balance.carriedOver - balance.used - balance.pending;
}
