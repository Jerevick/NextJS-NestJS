import type { FinanceTransactionType } from '@prisma/client';
import { NotificationPriority } from '@prisma/client';
import type { NotificationChannel } from './notification.types';

export type FinanceTransactionNotifyKind = 'payment' | 'refund' | 'credit' | 'charge' | 'other';

/** Map ledger type → notification event + channels (SMS/push on high-signal finance events). */
export function financeTransactionEvent(type: FinanceTransactionType): {
  event: string;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  kind: FinanceTransactionNotifyKind;
} {
  switch (type) {
    case 'PAYMENT':
      return {
        event: 'FINANCE_PAYMENT_RECEIVED',
        channels: ['inApp', 'push', 'sms'],
        priority: NotificationPriority.HIGH,
        kind: 'payment',
      };
    case 'REFUND':
      return {
        event: 'FINANCE_REFUND_RECEIVED',
        channels: ['inApp', 'push', 'sms'],
        priority: NotificationPriority.HIGH,
        kind: 'refund',
      };
    case 'SCHOLARSHIP_CREDIT':
      return {
        event: 'FINANCE_SCHOLARSHIP_CREDIT',
        channels: ['inApp', 'push'],
        priority: NotificationPriority.NORMAL,
        kind: 'credit',
      };
    case 'CHARGE':
      return {
        event: 'FINANCE_CHARGE_POSTED',
        channels: ['inApp', 'push'],
        priority: NotificationPriority.NORMAL,
        kind: 'charge',
      };
    default:
      return {
        event: 'FINANCE_TRANSACTION',
        channels: ['inApp'],
        priority: NotificationPriority.NORMAL,
        kind: 'other',
      };
  }
}

/** Fee reminders escalate channels as due date approaches. */
export function feeDueChannels(daysBefore: 7 | 3 | 1): NotificationChannel[] {
  if (daysBefore === 1) {
    return ['inApp', 'email', 'push', 'sms'];
  }
  if (daysBefore === 3) {
    return ['inApp', 'email', 'push'];
  }
  return ['inApp', 'email'];
}

export function feeDuePriority(daysBefore: 7 | 3 | 1): NotificationPriority {
  return daysBefore === 1 ? NotificationPriority.HIGH : NotificationPriority.NORMAL;
}

/** Voting window opened — push + email + in-app (no SMS blast). */
export const ELECTION_VOTING_OPEN_CHANNELS: NotificationChannel[] = ['inApp', 'email', 'push'];
