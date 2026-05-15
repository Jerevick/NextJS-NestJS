import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { BackfillRequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import type { CreateBackfillRequestDto } from './dto/create-backfill-request.dto';
import type { ListBackfillRequestsQueryDto } from './dto/list-backfill-requests-query.dto';
import type { RejectBackfillRequestDto } from './dto/reject-backfill-request.dto';
import { BillingInvoiceService } from '../billing/billing-invoice.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';

@Injectable()
export class BackfillRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly workflows: WorkflowEngineService,
    private readonly billingInvoices: BillingInvoiceService,
  ) {}

  async estimateRetroactiveFee(
    actor: AuthUser,
    studentId: string,
    fromDateIso: string,
    toDateIso: string,
  ) {
    const student = await this.assertStudentInScope(actor, actor.institutionId, studentId);
    const fromDate = new Date(fromDateIso);
    const toDate = new Date(toDateIso);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid date range');
    }
    if (fromDate > toDate) {
      throw new BadRequestException('fromDate must be on or before toDate');
    }
    return this.billingInvoices.estimateRetroactiveFee({
      institutionId: actor.institutionId,
      entityId: student.entityId,
      fromDate,
      toDate,
    });
  }

  private scopeEntityId(actor: AuthUser): string | undefined {
    return actor.entityScope === 'ALL' ? undefined : actor.entityId;
  }

  private async assertStudentInScope(
    actor: AuthUser,
    institutionId: string,
    studentId: string,
  ): Promise<{ id: string; entityId: string; studentNumber: string }> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
      select: { id: true, entityId: true, studentNumber: true },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (actor.entityScope === 'ENTITY' && student.entityId !== actor.entityId) {
      throw new ForbiddenException('Student is outside your campus entity scope');
    }
    return student;
  }

  private async loadRequest(actor: AuthUser, id: string) {
    const scope = this.scopeEntityId(actor);
    const row = await this.prisma.backfillRequest.findFirst({
      where: {
        id,
        institutionId: actor.institutionId,
        ...(scope ? { entityId: scope } : {}),
      },
      include: {
        student: { select: { id: true, studentNumber: true, enrollmentStatus: true } },
        entity: { select: { id: true, code: true, name: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Backfill request not found');
    }
    return row;
  }

  async submit(
    actor: AuthUser,
    dto: CreateBackfillRequestDto,
  ): Promise<{
    id: string;
    workflowInstanceId: string;
    estimatedRetroactiveFee: Awaited<ReturnType<BillingInvoiceService['estimateRetroactiveFee']>>;
  }> {
    if (!dto.billingAcknowledged) {
      throw new BadRequestException(
        'Retroactive billing acknowledgment is required before submitting a backfill request',
      );
    }
    const student = await this.assertStudentInScope(actor, actor.institutionId, dto.studentId);
    const fromDate = new Date(dto.fromDate);
    const toDate = new Date(dto.toDate);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid date range');
    }
    if (fromDate > toDate) {
      throw new BadRequestException('fromDate must be on or before toDate');
    }

    const pending = await this.prisma.backfillRequest.findFirst({
      where: {
        institutionId: actor.institutionId,
        studentId: dto.studentId,
        status: { in: [BackfillRequestStatus.PENDING, BackfillRequestStatus.UNDER_REVIEW] },
      },
      select: { id: true },
    });
    if (pending) {
      throw new ConflictException('A pending backfill request already exists for this student');
    }

    const created = await this.prisma.backfillRequest.create({
      data: {
        institutionId: actor.institutionId,
        entityId: student.entityId,
        studentId: student.id,
        fromDate,
        toDate,
        justification: dto.justification.trim(),
        billingAcknowledged: true,
        status: BackfillRequestStatus.UNDER_REVIEW,
      },
      select: { id: true },
    });

    const workflow = await this.workflows.initiateWorkflow({
      institutionId: actor.institutionId,
      entityId: student.entityId,
      definitionCode: 'BACKFILL_REQUEST',
      entityType: 'BackfillRequest',
      entityId_record: created.id,
      initiatedBy: actor.userId,
      metadata: {
        studentId: student.id,
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
      },
    });

    await this.prisma.backfillRequest.update({
      where: { id: created.id },
      data: { workflowInstanceId: workflow.id },
    });

    const estimatedRetroactiveFee = await this.billingInvoices.estimateRetroactiveFee({
      institutionId: actor.institutionId,
      entityId: student.entityId,
      fromDate,
      toDate,
    });

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'backfill_request.submit',
      entity: 'BackfillRequest',
      entityId: created.id,
      newValues: {
        studentId: student.id,
        studentNumber: student.studentNumber,
        entityId: student.entityId,
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
        billingImplication: 'RETROACTIVE_GAIN',
        estimatedRetroactiveAmount: estimatedRetroactiveFee.amount,
      } as Prisma.InputJsonValue,
    });

    return { id: created.id, workflowInstanceId: workflow.id, estimatedRetroactiveFee };
  }

  async list(actor: AuthUser, query: ListBackfillRequestsQueryDto) {
    const take = Math.min(query.limit ?? 20, 100);
    const scope = this.scopeEntityId(actor);
    const where: Prisma.BackfillRequestWhereInput = {
      institutionId: actor.institutionId,
      ...(scope ? { entityId: scope } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.studentId?.trim() ? { studentId: query.studentId.trim() } : {}),
    };
    const rows = await this.prisma.backfillRequest.findMany({
      where,
      take: take + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        studentId: true,
        entityId: true,
        fromDate: true,
        toDate: true,
        status: true,
        billingAcknowledged: true,
        createdAt: true,
        student: { select: { studentNumber: true, enrollmentStatus: true } },
      },
    });
    let nextCursor: string | null = null;
    const data = rows.length > take ? rows.slice(0, take) : rows;
    if (rows.length > take) {
      nextCursor = data[data.length - 1]?.id ?? null;
    }
    const total = await this.prisma.backfillRequest.count({ where });
    return { data, nextCursor, total };
  }

  async getById(actor: AuthUser, id: string) {
    return this.loadRequest(actor, id);
  }

  async approve(
    actor: AuthUser,
    id: string,
  ): Promise<{ ok: true; windowId: string; retroactiveInvoiceId: string | null }> {
    const request = await this.loadRequest(actor, id);
    if (
      request.status !== BackfillRequestStatus.PENDING &&
      request.status !== BackfillRequestStatus.UNDER_REVIEW
    ) {
      throw new BadRequestException('This backfill request cannot be approved in its current status');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.backfillWindow.updateMany({
        where: {
          institutionId: actor.institutionId,
          studentId: request.studentId,
          isActive: true,
          fromDate: { lte: request.toDate },
          toDate: { gte: request.fromDate },
        },
        data: { isActive: false },
      });

      const window = await tx.backfillWindow.create({
        data: {
          institutionId: actor.institutionId,
          entityId: request.entityId,
          studentId: request.studentId,
          backfillRequestId: request.id,
          fromDate: request.fromDate,
          toDate: request.toDate,
          isActive: true,
        },
        select: { id: true },
      });

      await tx.backfillRequest.update({
        where: { id: request.id },
        data: { status: BackfillRequestStatus.APPROVED },
      });

      return window.id;
    });

    let retroactiveInvoiceId: string | null = null;
    try {
      const inv = await this.billingInvoices.generateRetroactiveInvoiceForBackfill({
        institutionId: actor.institutionId,
        entityId: request.entityId,
        backfillRequestId: request.id,
        studentId: request.studentId,
        studentNumber: request.student.studentNumber,
        fromDate: request.fromDate,
        toDate: request.toDate,
      });
      retroactiveInvoiceId = inv.invoiceId;
    } catch {
      /* invoice generation is best-effort for manual approve path */
    }

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'backfill_request.approve',
      entity: 'BackfillRequest',
      entityId: id,
      oldValues: { status: request.status } as Prisma.InputJsonValue,
      newValues: {
        status: BackfillRequestStatus.APPROVED,
        windowId: result,
        billingImplication: 'RETROACTIVE_GAIN',
        retroactiveInvoiceId,
      } as Prisma.InputJsonValue,
    });

    return { ok: true as const, windowId: result, retroactiveInvoiceId };
  }

  async reject(actor: AuthUser, id: string, dto: RejectBackfillRequestDto): Promise<{ ok: true }> {
    const request = await this.loadRequest(actor, id);
    if (
      request.status !== BackfillRequestStatus.PENDING &&
      request.status !== BackfillRequestStatus.UNDER_REVIEW
    ) {
      throw new BadRequestException('This backfill request cannot be rejected in its current status');
    }
    await this.prisma.backfillRequest.update({
      where: { id: request.id },
      data: { status: BackfillRequestStatus.REJECTED },
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'backfill_request.reject',
      entity: 'BackfillRequest',
      entityId: id,
      oldValues: { status: request.status } as Prisma.InputJsonValue,
      newValues: {
        status: BackfillRequestStatus.REJECTED,
        comment: dto.comment?.trim() ?? null,
      } as Prisma.InputJsonValue,
    });
    return { ok: true as const };
  }

  async cancel(actor: AuthUser, id: string): Promise<{ ok: true }> {
    const request = await this.loadRequest(actor, id);
    if (request.status !== BackfillRequestStatus.PENDING) {
      throw new BadRequestException('Only PENDING requests can be cancelled');
    }
    await this.prisma.backfillRequest.update({
      where: { id: request.id },
      data: { status: BackfillRequestStatus.CANCELLED },
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'backfill_request.cancel',
      entity: 'BackfillRequest',
      entityId: id,
      oldValues: { status: request.status } as Prisma.InputJsonValue,
      newValues: { status: BackfillRequestStatus.CANCELLED } as Prisma.InputJsonValue,
    });
    return { ok: true as const };
  }
}
