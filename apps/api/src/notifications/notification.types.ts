import type { NotificationPriority } from '@prisma/client';

export type NotificationChannel = 'email' | 'sms' | 'push' | 'inApp';

export type NotificationChannelsConfig = Partial<Record<NotificationChannel, boolean>>;

export type SendNotificationInput = {
  institutionId: string;
  entityId?: string | null;
  recipientId: string;
  event: string;
  data?: Record<string, unknown>;
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  actionUrl?: string | null;
  /** Skip template cascade — use explicit title/body */
  title?: string;
  body?: string;
  /** ISO-8601 — deliver via BullMQ delayed job (requires Redis). */
  scheduledAt?: string;
};

export type ResolvedNotificationContent = {
  event: string;
  subject: string;
  title: string;
  body: string;
  htmlBody?: string;
  textBody?: string;
  channels: NotificationChannelsConfig;
  templateSource: 'entity' | 'institution' | 'platform';
};

/** One BullMQ job per channel (spec: "for each channel: dispatch to BullMQ queue"). */
export type NotificationDispatchJob = {
  institutionId: string;
  entityId?: string | null;
  recipientId: string;
  event: string;
  channel: NotificationChannel;
  priority: NotificationPriority;
  subject: string;
  title: string;
  body: string;
  htmlBody?: string;
  textBody?: string;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
};

export type SendNotificationResult = {
  queued: boolean;
  channels: NotificationChannel[];
  /** Set when processed synchronously (no Redis) and inApp channel ran. */
  notificationId?: string;
  /** LOW-priority email/sms/push held for hourly digest. */
  digested?: boolean;
};
