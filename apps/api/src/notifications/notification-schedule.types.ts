import type { ScheduledNotificationKind, ScheduledNotificationStatus } from '@prisma/client';
import type { SendBulkNotificationInput } from './notification-bulk.types';
import type { SendNotificationInput } from './notification.types';

export type ScheduledNotificationJobData = {
  scheduledNotificationId: string;
};

export type ScheduleSendInput = SendNotificationInput & {
  scheduledAt: string;
};

export type ScheduleBulkInput = SendBulkNotificationInput & {
  scheduledAt: string;
};

export type ScheduleNotificationResult = {
  scheduled: true;
  id: string;
  kind: ScheduledNotificationKind;
  scheduledAt: string;
  delayMs: number;
  status: ScheduledNotificationStatus;
};

export type ScheduledNotificationListItem = {
  id: string;
  kind: ScheduledNotificationKind;
  status: ScheduledNotificationStatus;
  event: string | null;
  recipientId: string | null;
  scheduledAt: string;
  sentAt: string | null;
  createdAt: string;
  errorMessage: string | null;
};
