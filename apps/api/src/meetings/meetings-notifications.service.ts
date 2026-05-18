import { Injectable, Logger } from '@nestjs/common';
import { MeetingActionStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MeetingsNotificationsService {
  private readonly log = new Logger(MeetingsNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  async notifyActionItemDue(item: {
    id: string;
    institutionId: string;
    description: string;
    dueDate: Date | null;
    assignedToId: string | null;
    meeting: { title: string };
  }) {
    if (!item.assignedToId || !item.dueDate) return;
    const title = `Action item due: ${item.meeting.title}`;
    const body = `${item.description} is due ${item.dueDate.toLocaleDateString()}.`;
    await this.notifications.create({
      institutionId: item.institutionId,
      userId: item.assignedToId,
      category: 'MEETINGS',
      title,
      body,
      actionUrl: '/meetings',
      metadata: { actionItemId: item.id },
    });
    const user = await this.prisma.user.findFirst({
      where: { id: item.assignedToId },
      select: { email: true },
    });
    if (user?.email) {
      try {
        await this.mail.sendEmail(user.email, title, body, `<p>${body}</p>`);
      } catch (e) {
        this.log.warn(`Action item email failed: ${String(e)}`);
      }
    }
  }

  async remindDueActionItems(): Promise<number> {
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const items = await this.prisma.meetingActionItem.findMany({
      where: {
        status: MeetingActionStatus.OPEN,
        dueDate: { lte: soon, gte: new Date() },
        assignedToId: { not: null },
      },
      include: { meeting: { select: { title: true } } },
      take: 100,
    });
    for (const item of items) {
      await this.notifyActionItemDue(item);
    }
    return items.length;
  }
}
