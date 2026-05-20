import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Prisma, ScheduledNotificationKind, ScheduledNotificationStatus } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { NOTIFICATION_SCHEDULED_QUEUE } from '../queues/queue.constants';
import { NotificationBulkService } from './notification-bulk.service';
import { NotificationEngineService } from './notification-engine.service';
import type { SendBulkNotificationInput } from './notification-bulk.types';
import type {
  ScheduleBulkInput,
  ScheduleNotificationResult,
  ScheduleSendInput,
  ScheduledNotificationJobData,
  ScheduledNotificationListItem,
} from './notification-schedule.types';
import type { SendNotificationInput, SendNotificationResult } from './notification.types';

const MAX_SCHEDULE_DAYS = 365;
const MIN_DELAY_MS = 60_000;

@Injectable()
export class NotificationScheduleService {
  private readonly log = new Logger(NotificationScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: NotificationEngineService,
    private readonly bulk: NotificationBulkService,
    private readonly audit: AuditService,
    @Optional() @InjectQueue(NOTIFICATION_SCHEDULED_QUEUE) private readonly queue?: Queue,
  ) {}

  async sendOrSchedule(
    actor: AuthUser,
    input: SendNotificationInput & { scheduledAt?: string },
  ): Promise<SendNotificationResult | ScheduleNotificationResult> {
    if (input.scheduledAt) {
      return this.scheduleSingle(actor, input as ScheduleSendInput);
    }
    return this.engine.send(input);
  }

  async scheduleSingle(
    actor: AuthUser,
    input: ScheduleSendInput,
  ): Promise<ScheduleNotificationResult> {
    const scheduledAt = this.parseScheduledAt(input.scheduledAt);
    const delayMs = this.delayMs(scheduledAt);

    const row = await this.prisma.scheduledNotification.create({
      data: {
        institutionId: input.institutionId,
        entityId: input.entityId,
        initiatedById: actor.userId,
        kind: ScheduledNotificationKind.SINGLE,
        recipientId: input.recipientId,
        event: input.event,
        payload: this.stripScheduleField(input) as Prisma.InputJsonValue,
        scheduledAt,
        status: ScheduledNotificationStatus.PENDING,
      },
    });

    await this.enqueueDelayed(row.id, delayMs);

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'notifications.scheduled',
      entity: 'ScheduledNotification',
      entityId: row.id,
      newValues: {
        kind: 'SINGLE',
        scheduledAt: scheduledAt.toISOString(),
      } as Prisma.InputJsonValue,
    });

    return this.toScheduleResult(row.id, ScheduledNotificationKind.SINGLE, scheduledAt, delayMs);
  }

  async scheduleBulk(
    actor: AuthUser,
    input: ScheduleBulkInput,
  ): Promise<ScheduleNotificationResult> {
    const scheduledAt = this.parseScheduledAt(input.scheduledAt);
    const delayMs = this.delayMs(scheduledAt);

    const { scheduledAt: _omit, ...bulkInput } = input;
    const row = await this.prisma.scheduledNotification.create({
      data: {
        institutionId: actor.institutionId,
        entityId: actor.entityScope === 'ENTITY' ? actor.entityId : input.entityId,
        initiatedById: actor.userId,
        kind: ScheduledNotificationKind.BULK,
        event: input.event ?? 'BULK_ANNOUNCEMENT',
        payload: {
          bulk: bulkInput,
          scope: { entityScope: actor.entityScope, entityId: actor.entityId },
        } as Prisma.InputJsonValue,
        scheduledAt,
        status: ScheduledNotificationStatus.PENDING,
      },
    });

    await this.enqueueDelayed(row.id, delayMs);

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'notifications.bulk.scheduled',
      entity: 'ScheduledNotification',
      entityId: row.id,
      newValues: {
        target: input.target,
        scheduledAt: scheduledAt.toISOString(),
      } as Prisma.InputJsonValue,
    });

    return this.toScheduleResult(row.id, ScheduledNotificationKind.BULK, scheduledAt, delayMs);
  }

  async deliver(scheduledNotificationId: string): Promise<void> {
    const row = await this.prisma.scheduledNotification.findUnique({
      where: { id: scheduledNotificationId },
    });
    if (!row || row.status !== ScheduledNotificationStatus.PENDING) {
      return;
    }

    try {
      if (row.kind === ScheduledNotificationKind.SINGLE) {
        const payload = row.payload as SendNotificationInput;
        const { institutionId: _ignored, scheduledAt: _s, ...sendPayload } = payload;
        await this.engine.send({
          institutionId: row.institutionId,
          ...sendPayload,
        });
      } else {
        const initiator = await this.prisma.user.findUnique({
          where: { id: row.initiatedById },
          select: { id: true, institutionId: true, email: true, role: true },
        });
        if (!initiator) {
          throw new Error('Initiator user not found');
        }
        const stored = row.payload as {
          bulk: SendBulkNotificationInput;
          scope: { entityScope: 'ALL' | 'ENTITY'; entityId: string };
        };
        const actor: AuthUser = {
          userId: initiator.id,
          email: initiator.email,
          role: initiator.role,
          institutionId: row.institutionId,
          entityId: stored.scope.entityId,
          entityScope: stored.scope.entityScope,
          permissions: ['notifications.broadcast'],
        };
        await this.bulk.send(actor, stored.bulk);
      }

      await this.prisma.scheduledNotification.update({
        where: { id: row.id },
        data: {
          status: ScheduledNotificationStatus.SENT,
          sentAt: new Date(),
        },
      });
      this.log.log(`Delivered scheduled notification ${row.id} (${row.kind})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.scheduledNotification.update({
        where: { id: row.id },
        data: {
          status: ScheduledNotificationStatus.FAILED,
          errorMessage: message,
        },
      });
      throw err;
    }
  }

  async listPending(actor: AuthUser, limit = 50): Promise<ScheduledNotificationListItem[]> {
    const rows = await this.prisma.scheduledNotification.findMany({
      where: {
        institutionId: actor.institutionId,
        status: ScheduledNotificationStatus.PENDING,
        ...(actor.entityScope === 'ENTITY' ? { entityId: actor.entityId } : {}),
      },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      status: r.status,
      event: r.event,
      recipientId: r.recipientId,
      scheduledAt: r.scheduledAt.toISOString(),
      sentAt: r.sentAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      errorMessage: r.errorMessage,
    }));
  }

  async cancel(
    actor: AuthUser,
    id: string,
  ): Promise<{ id: string; status: ScheduledNotificationStatus }> {
    const row = await this.prisma.scheduledNotification.findFirst({
      where: {
        id,
        institutionId: actor.institutionId,
        status: ScheduledNotificationStatus.PENDING,
      },
    });
    if (!row) {
      throw new NotFoundException('Scheduled notification not found or already sent');
    }
    if (actor.entityScope === 'ENTITY' && row.entityId && row.entityId !== actor.entityId) {
      throw new NotFoundException('Scheduled notification not found or already sent');
    }

    if (this.queue) {
      const job = await this.queue.getJob(id);
      if (job) {
        await job.remove();
      }
    }

    const updated = await this.prisma.scheduledNotification.update({
      where: { id: row.id },
      data: { status: ScheduledNotificationStatus.CANCELLED },
    });

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'notifications.scheduled.cancelled',
      entity: 'ScheduledNotification',
      entityId: id,
    });

    return { id: updated.id, status: updated.status };
  }

  private async enqueueDelayed(scheduledNotificationId: string, delayMs: number): Promise<void> {
    if (!this.queue) {
      throw new BadRequestException(
        'Scheduled notifications require REDIS_URL (BullMQ delayed jobs)',
      );
    }
    const jobData: ScheduledNotificationJobData = { scheduledNotificationId };
    await this.queue.add('deliver', jobData, {
      jobId: scheduledNotificationId,
      delay: delayMs,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 200,
      removeOnFail: 100,
    });
    await this.prisma.scheduledNotification.update({
      where: { id: scheduledNotificationId },
      data: { bullJobId: scheduledNotificationId },
    });
  }

  private parseScheduledAt(raw: string): Date {
    const scheduledAt = new Date(raw);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('scheduledAt must be a valid ISO-8601 datetime');
    }
    const max = new Date();
    max.setDate(max.getDate() + MAX_SCHEDULE_DAYS);
    if (scheduledAt > max) {
      throw new BadRequestException(
        `scheduledAt cannot be more than ${MAX_SCHEDULE_DAYS} days ahead`,
      );
    }
    return scheduledAt;
  }

  private delayMs(scheduledAt: Date): number {
    const delayMs = scheduledAt.getTime() - Date.now();
    if (delayMs < MIN_DELAY_MS) {
      throw new BadRequestException('scheduledAt must be at least 1 minute in the future');
    }
    return delayMs;
  }

  private stripScheduleField(input: ScheduleSendInput): Omit<ScheduleSendInput, 'scheduledAt'> {
    const { scheduledAt: _s, ...rest } = input;
    return rest;
  }

  private toScheduleResult(
    id: string,
    kind: ScheduledNotificationKind,
    scheduledAt: Date,
    delayMs: number,
  ): ScheduleNotificationResult {
    return {
      scheduled: true,
      id,
      kind,
      scheduledAt: scheduledAt.toISOString(),
      delayMs,
      status: ScheduledNotificationStatus.PENDING,
    };
  }
}
