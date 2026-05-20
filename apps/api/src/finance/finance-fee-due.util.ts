/** Days-before-due buckets for FEE_DUE notifications (spec: 7, 3, 1). */
export const FEE_DUE_REMINDER_DAYS = [7, 3, 1] as const;

export type FeeDueReminderDay = (typeof FEE_DUE_REMINDER_DAYS)[number];

/** True when `due` falls on the calendar day that is exactly `daysBefore` days from `today` (UTC date). */
export function isFeeDueReminderDay(
  due: Date,
  daysBefore: FeeDueReminderDay,
  today = new Date(),
): boolean {
  const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const target = new Date(today);
  target.setUTCDate(target.getUTCDate() + daysBefore);
  const targetDay = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return dueDay === targetDay;
}
