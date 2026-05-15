import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { BillingImplication, Prisma, StudentEnrollmentStatusEnum } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { SessionEventsService } from '../../sessions/session-events.service';
import type { StudentWithUserProgram } from '../students.repository';

function billingForTransition(
  from: StudentEnrollmentStatusEnum,
  to: StudentEnrollmentStatusEnum,
): BillingImplication {
  if (from !== 'ACTIVE' && to === 'ACTIVE') {
    return 'GAIN';
  }
  if (from === 'ACTIVE' && to !== 'ACTIVE') {
    return 'LOSS';
  }
  return 'NONE';
}

@Injectable()
export class StatusChangeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionEventsService,
  ) {}

  async changeEnrollmentStatus(args: {
    institutionId: string;
    actorUserId: string;
    studentId: string;
    toStatus: StudentEnrollmentStatusEnum;
    reason: string;
    inactiveReason?: string | null;
  }): Promise<StudentWithUserProgram> {
    const reason = args.reason.trim();
    if (reason.length < 3) {
      throw new BadRequestException('Status change reason must be at least 3 characters');
    }

    let auditPayload:
      | {
          fromStatus: StudentEnrollmentStatusEnum;
          toStatus: StudentEnrollmentStatusEnum;
          reason: string;
          billingImplication: BillingImplication;
        }
      | undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: args.studentId, institutionId: args.institutionId, deletedAt: null },
        select: {
          enrollmentStatus: true,
          entityId: true,
          userId: true,
        },
      });
      if (!student) {
        throw new NotFoundException('Student not found');
      }
      const from = student.enrollmentStatus;
      const to = args.toStatus;
      if (from === to) {
        return tx.student.findFirstOrThrow({
          where: { id: args.studentId, institutionId: args.institutionId, deletedAt: null },
          include: {
            user: { select: { id: true, email: true, profile: true, isActive: true } },
            program: { select: { id: true, name: true, code: true } },
            entity: { select: { id: true, code: true, name: true, type: true, status: true } },
          },
        });
      }

      const billingImplication = billingForTransition(from, to);
      auditPayload = { fromStatus: from, toStatus: to, reason, billingImplication };

      await tx.statusChangeLog.create({
        data: {
          institutionId: args.institutionId,
          entityId: student.entityId,
          studentId: args.studentId,
          fromStatus: from,
          toStatus: to,
          reason,
          changedBy: args.actorUserId,
          billingImplication,
        },
      });

      const inactiveFields =
        to === 'ACTIVE'
          ? { inactiveReason: null, inactiveSince: null }
          : to === 'INACTIVE' || to === 'SUSPENDED' || to === 'DEFERRED' || to === 'WITHDRAWN' || to === 'GRADUATED'
            ? {
                inactiveReason: args.inactiveReason?.trim() || to,
                inactiveSince: new Date(),
              }
            : {};

      const row = await tx.student.update({
        where: { id: args.studentId },
        data: { enrollmentStatus: to, ...inactiveFields },
        include: {
          user: { select: { id: true, email: true, profile: true, isActive: true } },
          program: { select: { id: true, name: true, code: true } },
          entity: { select: { id: true, code: true, name: true, type: true, status: true } },
        },
      });

      const shouldBumpSession = from === 'ACTIVE' && to !== 'ACTIVE';
      if (shouldBumpSession && student.userId) {
        await tx.user.update({
          where: { id: student.userId },
          data: { sessionVersion: { increment: 1 } },
        });
      }

      return row;
    });

    if (auditPayload) {
      this.audit.append({
        institutionId: args.institutionId,
        actorId: args.actorUserId,
        action: 'student.enrollment_status.change',
        entity: 'Student',
        entityId: args.studentId,
        oldValues: { enrollmentStatus: auditPayload.fromStatus } as Prisma.InputJsonValue,
        newValues: {
          enrollmentStatus: auditPayload.toStatus,
          reason: auditPayload.reason,
          billingImplication: auditPayload.billingImplication,
        } as Prisma.InputJsonValue,
      });
    }

    if (
      auditPayload &&
      auditPayload.fromStatus === 'ACTIVE' &&
      auditPayload.toStatus !== 'ACTIVE'
    ) {
      if (updated.user) {
        this.sessions.emitStudentSessionTerminated(
          updated.user.id,
          args.institutionId,
          'STUDENT_INACTIVE',
        );
      }
    }

    return updated;
  }

  async getBillingImpactReport(
    institutionId: string,
    options: { from?: Date; to?: Date; entityId?: string },
  ): Promise<{
    from: string;
    to: string;
    summary: { gain: number; loss: number; retroactiveGain: number; none: number };
    changes: Array<{
      id: string;
      studentId: string;
      entityId: string;
      fromStatus: StudentEnrollmentStatusEnum;
      toStatus: StudentEnrollmentStatusEnum;
      billingImplication: BillingImplication;
      recordedAt: string;
      reason: string;
    }>;
  }> {
    const to = options.to ?? new Date();
    const from =
      options.from ?? new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1, 0, 0, 0, 0));

    const rows = await this.prisma.statusChangeLog.findMany({
      where: {
        institutionId,
        recordedAt: { gte: from, lte: to },
        ...(options.entityId ? { entityId: options.entityId } : {}),
        billingImplication: { in: ['GAIN', 'LOSS', 'RETROACTIVE_GAIN'] },
      },
      orderBy: { recordedAt: 'desc' },
      take: 500,
      select: {
        id: true,
        studentId: true,
        entityId: true,
        fromStatus: true,
        toStatus: true,
        billingImplication: true,
        recordedAt: true,
        reason: true,
      },
    });

    const summary = { gain: 0, loss: 0, retroactiveGain: 0, none: 0 };
    for (const r of rows) {
      if (r.billingImplication === 'GAIN') {
        summary.gain += 1;
      } else if (r.billingImplication === 'LOSS') {
        summary.loss += 1;
      } else if (r.billingImplication === 'RETROACTIVE_GAIN') {
        summary.retroactiveGain += 1;
      } else {
        summary.none += 1;
      }
    }

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      summary,
      changes: rows.map((r) => ({
        id: r.id,
        studentId: r.studentId,
        entityId: r.entityId,
        fromStatus: r.fromStatus,
        toStatus: r.toStatus,
        billingImplication: r.billingImplication,
        recordedAt: r.recordedAt.toISOString(),
        reason: r.reason,
      })),
    };
  }
}
