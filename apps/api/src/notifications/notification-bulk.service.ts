import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { NotificationPriority, Prisma, StudentEnrollmentStatusEnum } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { NOTIFICATION_BULK_QUEUE } from '../queues/queue.constants';
import { NotificationEngineService } from './notification-engine.service';
import type {
  NotificationBulkJobData,
  SendBulkNotificationInput,
  SendBulkNotificationResult,
} from './notification-bulk.types';

const ASYNC_THRESHOLD = 25;
const SEND_CHUNK = 20;

@Injectable()
export class NotificationBulkService {
  private readonly log = new Logger(NotificationBulkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: NotificationEngineService,
    private readonly audit: AuditService,
    @Optional() @InjectQueue(NOTIFICATION_BULK_QUEUE) private readonly queue?: Queue,
  ) {}

  async send(
    actor: AuthUser,
    input: SendBulkNotificationInput,
  ): Promise<SendBulkNotificationResult> {
    this.validateScope(actor, input);
    const { userIds, entityIdByUserId } = await this.resolveRecipients(actor, input);

    if (!userIds.length) {
      return {
        target: input.target,
        recipientCount: 0,
        queued: false,
        sent: 0,
        failed: 0,
      };
    }

    const jobData: NotificationBulkJobData = {
      institutionId: actor.institutionId,
      recipientIds: userIds,
      entityIdByUserId,
      event: input.event ?? 'BULK_ANNOUNCEMENT',
      title: input.title,
      body: input.body,
      data: input.data,
      channels: input.channels,
      priority: input.priority ?? NotificationPriority.NORMAL,
      initiatedById: actor.userId,
    };

    if (this.queue && userIds.length >= ASYNC_THRESHOLD) {
      await this.queue.add('broadcast', jobData, { removeOnComplete: 100 });
      this.audit.append({
        institutionId: actor.institutionId,
        actorId: actor.userId,
        action: 'notifications.bulk.queued',
        entity: 'NotificationBulk',
        entityId: actor.institutionId,
        newValues: {
          target: input.target,
          recipientCount: userIds.length,
        } as Prisma.InputJsonValue,
      });
      return {
        target: input.target,
        recipientCount: userIds.length,
        queued: true,
        sent: 0,
        failed: 0,
      };
    }

    const result = await this.runJob(jobData);
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'notifications.bulk.sent',
      entity: 'NotificationBulk',
      entityId: actor.institutionId,
      newValues: {
        target: input.target,
        ...result,
      } as Prisma.InputJsonValue,
    });

    return {
      target: input.target,
      recipientCount: userIds.length,
      queued: false,
      ...result,
    };
  }

  async runJob(data: NotificationBulkJobData): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < data.recipientIds.length; i += SEND_CHUNK) {
      const chunk = data.recipientIds.slice(i, i + SEND_CHUNK);
      const outcomes = await Promise.all(
        chunk.map(async (recipientId) => {
          try {
            await this.engine.send({
              institutionId: data.institutionId,
              entityId: data.entityIdByUserId[recipientId] ?? null,
              recipientId,
              event: data.event,
              title: data.title,
              body: data.body,
              data: data.data,
              channels: data.channels,
              priority: data.priority,
            });
            return true;
          } catch (err) {
            this.log.warn(
              `Bulk notify failed for ${recipientId}: ${err instanceof Error ? err.message : String(err)}`,
            );
            return false;
          }
        }),
      );
      sent += outcomes.filter(Boolean).length;
      failed += outcomes.filter((ok) => !ok).length;
    }

    this.log.log(
      `Bulk broadcast ${data.event}: ${sent} sent, ${failed} failed (${data.recipientIds.length} recipients)`,
    );
    return { sent, failed };
  }

  private validateScope(actor: AuthUser, input: SendBulkNotificationInput): void {
    if (actor.entityScope === 'ENTITY') {
      if (input.target === 'ALL_INSTITUTION' || input.target === 'ALL_EXCEPT_ENTITY') {
        throw new ForbiddenException('Entity admins may only broadcast within their own entity');
      }
      if (input.target === 'SPECIFIC_ENTITY') {
        const entityId = input.entityId?.trim();
        if (!entityId || entityId !== actor.entityId) {
          throw new ForbiddenException('Entity admins may only target their assigned entity');
        }
      }
      return;
    }

    if (input.target === 'SPECIFIC_ENTITY' && !input.entityId?.trim()) {
      throw new BadRequestException('entityId is required for SPECIFIC_ENTITY');
    }
    if (input.target === 'ALL_EXCEPT_ENTITY' && !input.excludeEntityId?.trim()) {
      throw new BadRequestException('excludeEntityId is required for ALL_EXCEPT_ENTITY');
    }
    if (input.target === 'BY_PROGRAMME' && !input.programId?.trim()) {
      throw new BadRequestException('programId is required for BY_PROGRAMME');
    }
  }

  private async resolveRecipients(
    actor: AuthUser,
    input: SendBulkNotificationInput,
  ): Promise<{ userIds: string[]; entityIdByUserId: Record<string, string> }> {
    const where: Prisma.StudentWhereInput = {
      institutionId: actor.institutionId,
      deletedAt: null,
      userId: { not: null },
      enrollmentStatus: StudentEnrollmentStatusEnum.ACTIVE,
    };

    switch (input.target) {
      case 'ALL_INSTITUTION':
        break;
      case 'SPECIFIC_ENTITY': {
        const entityId = actor.entityScope === 'ENTITY' ? actor.entityId : input.entityId!.trim();
        where.entityId = entityId;
        break;
      }
      case 'ALL_EXCEPT_ENTITY':
        where.entityId = { not: input.excludeEntityId!.trim() };
        break;
      case 'BY_PROGRAMME': {
        const program = await this.prisma.program.findFirst({
          where: {
            id: input.programId!.trim(),
            institutionId: actor.institutionId,
            deletedAt: null,
          },
          select: { id: true, entityId: true },
        });
        if (!program) {
          throw new BadRequestException('Programme not found');
        }
        if (actor.entityScope === 'ENTITY' && program.entityId !== actor.entityId) {
          throw new ForbiddenException('Programme is outside your entity scope');
        }
        where.programId = program.id;
        break;
      }
    }

    const students = await this.prisma.student.findMany({
      where,
      select: { userId: true, entityId: true },
    });

    const entityIdByUserId: Record<string, string> = {};
    const userIds: string[] = [];
    const seen = new Set<string>();
    for (const s of students) {
      if (!s.userId || seen.has(s.userId)) continue;
      seen.add(s.userId);
      userIds.push(s.userId);
      entityIdByUserId[s.userId] = s.entityId;
    }

    return { userIds, entityIdByUserId };
  }
}
