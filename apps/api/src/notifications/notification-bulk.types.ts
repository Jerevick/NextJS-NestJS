import type { NotificationPriority } from '@prisma/client';
import type { NotificationChannel } from './notification.types';

export type BulkNotificationTarget =
  | 'ALL_INSTITUTION'
  | 'SPECIFIC_ENTITY'
  | 'ALL_EXCEPT_ENTITY'
  | 'BY_PROGRAMME';

export type SendBulkNotificationInput = {
  target: BulkNotificationTarget;
  /** Required for SPECIFIC_ENTITY */
  entityId?: string;
  /** Required for ALL_EXCEPT_ENTITY */
  excludeEntityId?: string;
  /** Required for BY_PROGRAMME */
  programId?: string;
  event?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  /** ISO-8601 — queue for future delivery (requires Redis). */
  scheduledAt?: string;
};

export type NotificationBulkJobData = {
  institutionId: string;
  recipientIds: string[];
  entityIdByUserId: Record<string, string>;
  event: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  initiatedById: string;
};

export type SendBulkNotificationResult = {
  target: BulkNotificationTarget;
  recipientCount: number;
  queued: boolean;
  sent: number;
  failed: number;
};
