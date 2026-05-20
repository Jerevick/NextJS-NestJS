import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SESSION_REALTIME, type SessionRealtimeEmitter } from '../sessions/session-realtime.token';
import { ObjectStorageService } from '../storage/object-storage.service';
import { NotificationEmailService } from './channels/notification-email.service';
import { NotificationPushService } from './channels/notification-push.service';
import { NotificationSmsService } from './channels/notification-sms.service';
import type { NotificationDispatchJob } from './notification.types';

@Injectable()
export class NotificationChannelService {
  private readonly log = new Logger(NotificationChannelService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: NotificationEmailService,
    private readonly sms: NotificationSmsService,
    private readonly push: NotificationPushService,
    @Optional()
    @Inject(SESSION_REALTIME)
    private readonly realtime: SessionRealtimeEmitter | null,
    private readonly storage: ObjectStorageService,
  ) {}

  /** Dispatches a single channel; returns notification id when inApp. */
  async dispatch(job: NotificationDispatchJob): Promise<string | undefined> {
    switch (job.channel) {
      case 'inApp':
        return this.dispatchInApp(job);
      case 'email':
        await this.dispatchEmail(job);
        return undefined;
      case 'sms':
        await this.dispatchSms(job);
        return undefined;
      case 'push':
        await this.dispatchPush(job);
        return undefined;
    }
  }

  private async dispatchInApp(job: NotificationDispatchJob): Promise<string> {
    const row = await this.prisma.userNotification.create({
      data: {
        institutionId: job.institutionId,
        entityId: job.entityId,
        userId: job.recipientId,
        event: job.event,
        category: job.event.toLowerCase(),
        title: job.title,
        body: job.body,
        actionUrl: job.actionUrl,
        channels: [job.channel],
        priority: job.priority,
        metadata: (job.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    this.realtime?.emitUserNotification(job.recipientId, {
      id: row.id,
      event: job.event,
      title: job.title,
      body: job.body,
      actionUrl: job.actionUrl,
      createdAt: row.createdAt.toISOString(),
    });

    return row.id;
  }

  private async dispatchEmail(job: NotificationDispatchJob): Promise<void> {
    const meta = job.metadata ?? {};
    const overrideEmail = typeof meta.recipientEmail === 'string' ? meta.recipientEmail.trim() : '';

    let to = overrideEmail;
    if (!to) {
      const user = await this.prisma.user.findFirst({
        where: { id: job.recipientId, institutionId: job.institutionId, deletedAt: null },
        select: { email: true },
      });
      to = user?.email?.trim() ?? '';
    }
    if (!to) {
      this.log.warn(`No email for user ${job.recipientId} — email channel skipped`);
      return;
    }

    const attachments = await this.resolveEmailAttachments(meta);
    await this.email.send(
      job.institutionId,
      to,
      job.subject,
      job.textBody ?? job.body,
      job.htmlBody ?? `<p>${job.body}</p>`,
      attachments,
    );
  }

  private async resolveEmailAttachments(
    meta: Record<string, unknown>,
  ): Promise<Array<{ filename: string; content: Buffer }> | undefined> {
    const storageKey =
      typeof meta.receiptStorageKey === 'string' ? meta.receiptStorageKey.trim() : '';
    if (!storageKey) {
      return undefined;
    }
    const buffer = await this.storage.getBuffer(storageKey);
    if (!buffer) {
      this.log.warn(`Attachment missing for storage key ${storageKey}`);
      return undefined;
    }
    const filename =
      typeof meta.attachmentFilename === 'string' && meta.attachmentFilename.trim()
        ? meta.attachmentFilename.trim()
        : 'attachment.pdf';
    return [{ filename, content: buffer }];
  }

  private async dispatchSms(job: NotificationDispatchJob): Promise<void> {
    const text = job.textBody ?? job.body;
    await this.sms.send(job.institutionId, job.recipientId, text);
  }

  private async dispatchPush(job: NotificationDispatchJob): Promise<void> {
    const data: Record<string, string> = {
      event: job.event,
      institutionId: job.institutionId,
    };
    if (job.actionUrl) data.actionUrl = job.actionUrl;
    if (job.entityId) data.entityId = job.entityId;

    const result = await this.push.send(job.institutionId, job.recipientId, {
      title: job.title,
      body: job.body,
      data,
    });
    if (result.sent === 0 && result.failed === 0) {
      return;
    }
    if (result.sent === 0) {
      throw new Error('Push delivery failed');
    }
  }
}
