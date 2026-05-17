import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

export type CreateNotificationInput = {
  institutionId: string;
  userId: string;
  category: string;
  title: string;
  body: string;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateNotificationInput) {
    return this.prisma.userNotification.create({
      data: {
        institutionId: input.institutionId,
        userId: input.userId,
        category: input.category,
        title: input.title,
        body: input.body,
        actionUrl: input.actionUrl ?? null,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async listForUser(actor: AuthUser, unreadOnly = false) {
    const rows = await this.prisma.userNotification.findMany({
      where: {
        institutionId: actor.institutionId,
        userId: actor.userId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      data: rows.map((r) => ({
        id: r.id,
        category: r.category,
        title: r.title,
        body: r.body,
        actionUrl: r.actionUrl,
        readAt: r.readAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      unreadCount: rows.filter((r) => !r.readAt).length,
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

  /** Resolve student portal user for finance alerts. */
  async findStudentUserId(institutionId: string, studentId: string): Promise<string | null> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
      select: { userId: true },
    });
    return student?.userId ?? null;
  }
}
