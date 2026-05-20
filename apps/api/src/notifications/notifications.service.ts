import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationPriority, Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePageLimit, sliceCursorPage } from '../common/pagination/cursor-page.util';
import type { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationEngineService } from './notification-engine.service';
import { NotificationScheduleService } from './notification-schedule.service';
import type { ScheduleNotificationResult } from './notification-schedule.types';
import type { SendNotificationInput, SendNotificationResult } from './notification.types';

export type CreateNotificationInput = {
  institutionId: string;
  entityId?: string | null;
  userId: string;
  category: string;
  title: string;
  body: string;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
  event?: string;
  priority?: NotificationPriority;
};

/** Phase 14 — in-app center + multi-channel `send()` with template cascade. */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: NotificationEngineService,
    private readonly schedule: NotificationScheduleService,
  ) {}

  /**
   * System/programmatic send (no auth actor) — template cascade + multi-channel dispatch.
   * Prefer this over legacy `create()` for finance, meetings, HR, etc.
   */
  sendSystem(input: SendNotificationInput): Promise<SendNotificationResult> {
    return this.engine.send(input);
  }

  /** @deprecated Use `sendSystem()` — delegates to the notification engine. */
  async create(input: CreateNotificationInput): Promise<SendNotificationResult> {
    return this.sendSystem({
      institutionId: input.institutionId,
      entityId: input.entityId,
      recipientId: input.userId,
      event: input.event ?? input.category,
      title: input.title,
      body: input.body,
      actionUrl: input.actionUrl,
      data: input.metadata,
      priority: input.priority,
      channels: ['inApp'],
    });
  }

  /**
   * Spec API (`NotificationService.send`):
   * cascade template → enqueue per channel → store in-app `UserNotification`.
   */
  send(
    actor: AuthUser,
    input: SendNotificationInput,
  ): Promise<SendNotificationResult | ScheduleNotificationResult> {
    return this.schedule.sendOrSchedule(actor, input);
  }

  async listForUser(actor: AuthUser, query: ListNotificationsQueryDto = {}) {
    const limit = normalizePageLimit(query.limit, 50, 100);
    const unreadOnly = query.unreadOnly ?? false;
    const where = {
      institutionId: actor.institutionId,
      userId: actor.userId,
      ...(unreadOnly ? { readAt: null } : {}),
    };
    const [rows, unreadCount] = await Promise.all([
      this.prisma.userNotification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      }),
      this.prisma.userNotification.count({
        where: {
          institutionId: actor.institutionId,
          userId: actor.userId,
          readAt: null,
        },
      }),
    ]);
    const { data, nextCursor } = sliceCursorPage(rows, limit);
    return {
      data: data.map((r) => this.toNotificationDto(r)),
      nextCursor,
      unreadCount,
    };
  }

  /** Read receipt — marks `readAt` when a notification is opened. */
  async getById(actor: AuthUser, notificationId: string, markRead = true) {
    const row = await this.prisma.userNotification.findFirst({
      where: {
        id: notificationId,
        institutionId: actor.institutionId,
        userId: actor.userId,
      },
    });
    if (!row) {
      throw new NotFoundException('Notification not found');
    }
    if (markRead && !row.readAt) {
      const updated = await this.prisma.userNotification.update({
        where: { id: row.id },
        data: { readAt: new Date() },
      });
      return this.toNotificationDto(updated);
    }
    return this.toNotificationDto(row);
  }

  private toNotificationDto(r: {
    id: string;
    category: string;
    event: string | null;
    title: string;
    body: string;
    actionUrl: string | null;
    priority: NotificationPriority;
    readAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: r.id,
      category: r.category,
      event: r.event,
      title: r.title,
      body: r.body,
      actionUrl: r.actionUrl,
      priority: r.priority,
      readAt: r.readAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  }

  async markRead(actor: AuthUser, notificationId: string) {
    const row = await this.prisma.userNotification.findFirst({
      where: {
        id: notificationId,
        institutionId: actor.institutionId,
        userId: actor.userId,
      },
    });
    if (!row) {
      throw new NotFoundException('Notification not found');
    }
    if (row.readAt) {
      return { id: row.id, readAt: row.readAt.toISOString() };
    }
    const updated = await this.prisma.userNotification.update({
      where: { id: row.id },
      data: { readAt: new Date() },
    });
    return { id: updated.id, readAt: updated.readAt!.toISOString() };
  }

  async markAllRead(actor: AuthUser) {
    const result = await this.prisma.userNotification.updateMany({
      where: {
        institutionId: actor.institutionId,
        userId: actor.userId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async findStudentUserId(institutionId: string, studentId: string): Promise<string | null> {
    const target = await this.findStudentNotificationTarget(institutionId, studentId);
    return target?.userId ?? null;
  }

  async findStudentNotificationTarget(
    institutionId: string,
    studentId: string,
  ): Promise<{ userId: string; entityId: string } | null> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
      select: { userId: true, entityId: true },
    });
    if (!student?.userId) {
      return null;
    }
    return { userId: student.userId, entityId: student.entityId };
  }
}
