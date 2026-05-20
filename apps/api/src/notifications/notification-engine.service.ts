import { Injectable, Logger } from '@nestjs/common';
import { NotificationPriority } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationDigestService } from './notification-digest.service';
import { NotificationJobsService } from './jobs/notification-jobs.service';
import { isWithinQuietHours } from './notification-quiet-hours.util';
import { NotificationTemplateService } from './notification-template.service';
import { readUserQuietHours, readUserTimezone } from './notification-user-preferences.util';
import type {
  NotificationChannel,
  NotificationChannelsConfig,
  SendNotificationInput,
  SendNotificationResult,
} from './notification.types';

const DIGEST_DEFERRABLE: NotificationChannel[] = ['email', 'sms', 'push'];

/**
 * Spec: NotificationService.send — cascade templates, per-channel BullMQ, in-app record.
 * Smart: quiet hours (timezone), digest (LOW), push→email fallback in jobs layer.
 * @see UNICORE_MASTER_PROMPT.md Prompt 14.1
 */
@Injectable()
export class NotificationEngineService {
  private readonly log = new Logger(NotificationEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: NotificationTemplateService,
    private readonly jobs: NotificationJobsService,
    private readonly digest: NotificationDigestService,
  ) {}

  async send(input: SendNotificationInput): Promise<SendNotificationResult> {
    const resolved = await this.templates.resolve(input);
    let channelList = this.resolveChannels(resolved.channels, input.channels);
    const priority = input.priority ?? NotificationPriority.NORMAL;

    if (await this.isQuietHours(input.recipientId, priority)) {
      this.log.debug(`Quiet hours — only inApp for ${input.event}`);
      channelList = channelList.filter((c) => c === 'inApp');
      if (!channelList.length) {
        return { queued: false, channels: [] };
      }
    }

    const base = {
      institutionId: input.institutionId,
      entityId: input.entityId,
      recipientId: input.recipientId,
      event: input.event,
      priority,
      subject: resolved.subject,
      title: resolved.title,
      body: resolved.body,
      htmlBody: resolved.htmlBody,
      textBody: resolved.textBody,
      actionUrl: input.actionUrl,
      metadata: {
        ...input.data,
        templateSource: resolved.templateSource,
      },
    };

    let digestedChannels: NotificationChannel[] = [];
    if (
      priority === NotificationPriority.LOW &&
      (await this.digest.shouldDigest(input.recipientId))
    ) {
      digestedChannels = channelList.filter((c) => DIGEST_DEFERRABLE.includes(c));
      channelList = channelList.filter((c) => !DIGEST_DEFERRABLE.includes(c));
      if (digestedChannels.length) {
        await this.digest.buffer({
          institutionId: input.institutionId,
          recipientId: input.recipientId,
          event: input.event,
          channels: digestedChannels,
          subject: resolved.subject,
          title: resolved.title,
          body: resolved.body,
          htmlBody: resolved.htmlBody,
          textBody: resolved.textBody,
          actionUrl: input.actionUrl,
          metadata: base.metadata,
        });
      }
      if (!channelList.length) {
        return {
          queued: false,
          channels: digestedChannels,
          digested: true,
        };
      }
    }

    const { notificationId } = await this.jobs.enqueueAll(base, channelList);

    return {
      queued: Boolean(process.env.REDIS_URL?.trim()),
      channels: [...channelList, ...digestedChannels],
      notificationId,
      digested: digestedChannels.length > 0,
    };
  }

  private resolveChannels(
    templateChannels: NotificationChannelsConfig,
    override?: NotificationChannel[],
  ): NotificationChannel[] {
    if (override?.length) return override;
    const out: NotificationChannel[] = [];
    if (templateChannels.email) out.push('email');
    if (templateChannels.sms) out.push('sms');
    if (templateChannels.push) out.push('push');
    if (templateChannels.inApp !== false) out.push('inApp');
    return out.length ? out : ['inApp'];
  }

  private async isQuietHours(userId: string, priority: NotificationPriority): Promise<boolean> {
    if (priority === NotificationPriority.HIGH) return false;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { profile: true },
    });
    const qh = readUserQuietHours(user?.profile);
    if (!qh) return false;
    const timezone = readUserTimezone(user?.profile);
    return isWithinQuietHours(qh, timezone);
  }
}
