import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getPlatformTemplate } from './platform-notification-templates';
import { parseChannelsJson, renderTemplate } from './notification-template.util';
import type {
  NotificationChannelsConfig,
  ResolvedNotificationContent,
  SendNotificationInput,
} from './notification.types';

@Injectable()
export class NotificationTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(input: SendNotificationInput): Promise<ResolvedNotificationContent> {
    if (input.title && input.body) {
      return {
        event: input.event,
        subject: input.title,
        title: input.title,
        body: input.body,
        channels: this.channelsFromOverride(input.channels),
        templateSource: 'platform',
      };
    }

    const data = input.data ?? {};
    const entityTpl = input.entityId
      ? await this.prisma.notificationTemplate.findFirst({
          where: {
            institutionId: input.institutionId,
            entityId: input.entityId,
            event: input.event,
          },
        })
      : null;

    const instTpl =
      !entityTpl &&
      (await this.prisma.notificationTemplate.findFirst({
        where: {
          institutionId: input.institutionId,
          entityId: null,
          event: input.event,
        },
      }));

    const dbTpl = entityTpl ?? instTpl;
    if (dbTpl) {
      const channels = parseChannelsJson(dbTpl.channels);
      const subject = renderTemplate(dbTpl.subject ?? input.event, data);
      const textBody = renderTemplate(dbTpl.textBody ?? dbTpl.subject ?? input.event, data);
      const htmlBody = dbTpl.htmlBody ? renderTemplate(dbTpl.htmlBody, data) : `<p>${textBody}</p>`;
      return {
        event: input.event,
        subject,
        title: subject,
        body: textBody,
        htmlBody,
        textBody,
        channels,
        templateSource: entityTpl ? 'entity' : 'institution',
      };
    }

    const platform = getPlatformTemplate(input.event) ?? getPlatformTemplate('GENERIC')!;
    const subject = renderTemplate(platform.subject, data);
    const textBody = renderTemplate(platform.textBody, data);
    const htmlBody = renderTemplate(platform.htmlBody, data);
    return {
      event: input.event,
      subject,
      title: subject,
      body: textBody,
      htmlBody,
      textBody,
      channels: platform.channels,
      templateSource: 'platform',
    };
  }

  listTemplates(institutionId: string, entityId?: string) {
    return this.prisma.notificationTemplate.findMany({
      where: {
        institutionId,
        ...(entityId !== undefined ? { entityId: entityId || null } : {}),
      },
      orderBy: [{ event: 'asc' }, { entityId: 'asc' }],
    });
  }

  async upsertTemplate(data: {
    institutionId: string;
    entityId?: string | null;
    event: string;
    channels: Record<string, boolean>;
    subject?: string;
    htmlBody?: string;
    textBody?: string;
  }) {
    const existing = await this.prisma.notificationTemplate.findFirst({
      where: {
        institutionId: data.institutionId,
        entityId: data.entityId ?? null,
        event: data.event,
      },
    });
    if (existing) {
      return this.prisma.notificationTemplate.update({
        where: { id: existing.id },
        data: {
          channels: data.channels as Prisma.InputJsonValue,
          subject: data.subject,
          htmlBody: data.htmlBody,
          textBody: data.textBody,
        },
      });
    }
    return this.prisma.notificationTemplate.create({
      data: {
        institutionId: data.institutionId,
        entityId: data.entityId,
        event: data.event,
        channels: data.channels as Prisma.InputJsonValue,
        subject: data.subject,
        htmlBody: data.htmlBody,
        textBody: data.textBody,
      },
    });
  }

  private channelsFromOverride(channels?: string[]): NotificationChannelsConfig {
    if (!channels?.length) return { inApp: true };
    const cfg: NotificationChannelsConfig = {};
    for (const ch of channels) {
      cfg[ch as keyof NotificationChannelsConfig] = true;
    }
    return cfg;
  }
}
