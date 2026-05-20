import { Injectable, Logger } from '@nestjs/common';
import { MeetingActionStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MeetingsNotificationsService {
  private readonly log = new Logger(MeetingsNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async notifyActionItemDue(item: {
    id: string;
    institutionId: string;
    entityId?: string | null;
    description: string;
    dueDate: Date | null;
    assignedToId: string | null;
    meeting: { title: string };
  }) {
    if (!item.assignedToId || !item.dueDate) return;

    const dueDate = item.dueDate.toLocaleDateString();
    await this.notifications.sendSystem({
      institutionId: item.institutionId,
      entityId: item.entityId,
      recipientId: item.assignedToId,
      event: 'MEETING_ACTION_DUE',
      data: {
        meetingTitle: item.meeting.title,
        description: item.description,
        dueDate,
      },
      actionUrl: '/meetings',
      channels: ['inApp', 'email'],
    });
  }

  async remindDueActionItems(): Promise<number> {
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const items = await this.prisma.meetingActionItem.findMany({
      where: {
        status: MeetingActionStatus.OPEN,
        dueDate: { lte: soon, gte: new Date() },
        assignedToId: { not: null },
      },
      include: {
        meeting: { select: { title: true, entityId: true } },
      },
      take: 100,
    });
    for (const item of items) {
      await this.notifyActionItemDue({
        id: item.id,
        institutionId: item.institutionId,
        entityId: item.entityId,
        description: item.description,
        dueDate: item.dueDate,
        assignedToId: item.assignedToId,
        meeting: item.meeting,
      });
    }
    return items.length;
  }
}
