import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationEmailService } from './channels/notification-email.service';
import { NotificationSmsService } from './channels/notification-sms.service';
import { isDigestModeEnabled } from './notification-user-preferences.util';
import type { NotificationChannel } from './notification.types';

const DIGEST_CHANNELS: NotificationChannel[] = ['email', 'sms', 'push'];

export type DigestBufferInput = {
  institutionId: string;
  recipientId: string;
  event: string;
  channels: NotificationChannel[];
  subject: string;
  title: string;
  body: string;
  htmlBody?: string;
  textBody?: string;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class NotificationDigestService {
  private readonly log = new Logger(NotificationDigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: NotificationEmailService,
    private readonly sms: NotificationSmsService,
  ) {}

  async shouldDigest(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { profile: true },
    });
    return isDigestModeEnabled(user?.profile);
  }

  async buffer(input: DigestBufferInput): Promise<void> {
    const channels = input.channels.filter((c) => DIGEST_CHANNELS.includes(c));
    if (!channels.length) return;

    await this.prisma.notificationDigestEntry.create({
      data: {
        institutionId: input.institutionId,
        userId: input.recipientId,
        event: input.event,
        channels,
        subject: input.subject,
        title: input.title,
        body: input.body,
        htmlBody: input.htmlBody,
        textBody: input.textBody,
        actionUrl: input.actionUrl,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    this.log.debug(`Buffered digest for ${input.recipientId} (${channels.join(',')})`);
  }

  /** Flush all pending digest entries — one combined email per user per institution. */
  async flushHourlyDigests(): Promise<{ users: number; entries: number }> {
    const pending = await this.prisma.notificationDigestEntry.findMany({
      orderBy: [{ userId: 'asc' }, { createdAt: 'asc' }],
      take: 5000,
    });
    if (!pending.length) {
      return { users: 0, entries: 0 };
    }

    const byKey = new Map<string, typeof pending>();
    for (const row of pending) {
      const key = `${row.institutionId}:${row.userId}`;
      const list = byKey.get(key) ?? [];
      list.push(row);
      byKey.set(key, list);
    }

    let users = 0;
    for (const [, entries] of byKey) {
      const first = entries[0]!;
      const wantsEmail = entries.some((e) => e.channels.includes('email'));
      const wantsSms = entries.some((e) => e.channels.includes('sms'));

      if (wantsEmail) {
        const subject = `Your UniCore digest (${entries.length} update${entries.length === 1 ? '' : 's'})`;
        const textLines = entries.map((e) => `• ${e.title}: ${e.body}`);
        const htmlItems = entries
          .map((e) => {
            const link = e.actionUrl
              ? `<a href="${e.actionUrl}">${e.title}</a>`
              : `<strong>${e.title}</strong>`;
            return `<li>${link}<br/><span style="color:#64748b">${e.body}</span></li>`;
          })
          .join('');
        const text = `Hello,\n\nHere is your hourly notification digest:\n\n${textLines.join('\n')}\n`;
        const html = `<p>Hello,</p><p>Here is your hourly notification digest:</p><ul>${htmlItems}</ul>`;

        const user = await this.prisma.user.findFirst({
          where: { id: first.userId, institutionId: first.institutionId, deletedAt: null },
          select: { email: true },
        });
        if (user?.email) {
          await this.email.send(first.institutionId, user.email, subject, text, html);
        }
      }

      if (wantsSms) {
        const summary = `UniCore: ${entries.length} notification${entries.length === 1 ? '' : 's'} in your digest. Log in to view.`;
        await this.sms.send(first.institutionId, first.userId, summary);
      }

      await this.prisma.notificationDigestEntry.deleteMany({
        where: { id: { in: entries.map((e) => e.id) } },
      });
      users += 1;
    }

    this.log.log(`Digest flush: ${users} user(s), ${pending.length} entr(ies)`);
    return { users, entries: pending.length };
  }
}
