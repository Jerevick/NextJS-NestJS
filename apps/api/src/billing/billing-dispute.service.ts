import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { BillingDisputeStatus, InvoiceStatus, StudentEnrollmentStatusEnum } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { InitiateBillingDisputeDto } from './dto/initiate-billing-dispute.dto';
import type { ListBillingDisputesQueryDto } from './dto/list-billing-disputes-query.dto';
import type { ResolveBillingDisputeDto } from './dto/resolve-billing-dispute.dto';

export type DisputeLineJson = {
  studentId: string;
  studentNumber: string;
  autoVerdict: 'AUTO_ACCEPT' | 'AUTO_REJECT';
  explanation: string;
};

function assertDisputeResolve(actor: AuthUser): void {
  if (actor.permissions.includes('*') || actor.permissions.includes('billing.disputes.resolve')) {
    return;
  }
  throw new ForbiddenException('Missing permission to resolve billing disputes');
}

@Injectable()
export class BillingDisputeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async initiate(actor: AuthUser, invoiceId: string, dto: InitiateBillingDisputeDto) {
    const reason = dto.reason.trim();
    if (reason.length < 5) {
      throw new BadRequestException('Reason must be at least 5 characters');
    }
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, institutionId: actor.institutionId, deletedAt: null },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (invoice.status !== InvoiceStatus.DRAFT && invoice.status !== InvoiceStatus.OPEN) {
      throw new BadRequestException('Disputes can only be opened for draft or open invoices');
    }
    if (invoice.lockedAt) {
      throw new BadRequestException('This invoice is locked and cannot be disputed');
    }

    const open = await this.prisma.billingDispute.findFirst({
      where: {
        invoiceId,
        deletedAt: null,
        status: { in: [BillingDisputeStatus.OPEN, BillingDisputeStatus.MANUAL_REVIEW] },
      },
      select: { id: true },
    });
    if (open) {
      throw new ConflictException('An active billing dispute already exists for this invoice');
    }

    const ids = dto.disputedStudentIds?.filter((s) => s.trim()) ?? [];
    const lines: DisputeLineJson[] = [];
    for (const sid of ids) {
      const student = await this.prisma.student.findFirst({
        where: { id: sid.trim(), institutionId: actor.institutionId, deletedAt: null },
        select: { id: true, studentNumber: true, enrollmentStatus: true, entityId: true },
      });
      if (!student) {
        throw new BadRequestException(`Unknown student id in dispute: ${sid}`);
      }
      if (actor.entityScope === 'ENTITY' && student.entityId !== actor.entityId) {
        throw new ForbiddenException('Student is outside your campus entity scope');
      }
      const active = student.enrollmentStatus === StudentEnrollmentStatusEnum.ACTIVE;
      const autoVerdict: DisputeLineJson['autoVerdict'] = active ? 'AUTO_REJECT' : 'AUTO_ACCEPT';
      const explanation = active
        ? 'Student enrollment is ACTIVE; under the status-only billing contract this line is auto-rejected.'
        : 'Student is not ACTIVE; provisional auto-accept pending manual confirmation of inactive coverage.';
      lines.push({
        studentId: student.id,
        studentNumber: student.studentNumber,
        autoVerdict,
        explanation,
      });
    }

    let status: BillingDisputeStatus = BillingDisputeStatus.OPEN;
    if (lines.length === 0) {
      status = BillingDisputeStatus.MANUAL_REVIEW;
    } else {
      const accepts = lines.filter((l) => l.autoVerdict === 'AUTO_ACCEPT').length;
      const rejects = lines.filter((l) => l.autoVerdict === 'AUTO_REJECT').length;
      if (accepts > 0 && rejects > 0) {
        status = BillingDisputeStatus.MANUAL_REVIEW;
      } else if (rejects > 0) {
        status = BillingDisputeStatus.AUTO_RESOLVED_REJECTED;
      } else {
        status = BillingDisputeStatus.AUTO_RESOLVED_ACCEPTED;
      }
    }

    const row = await this.prisma.billingDispute.create({
      data: {
        institutionId: actor.institutionId,
        invoiceId,
        status,
        reason,
        lines: lines as unknown as Prisma.InputJsonValue,
        createdBy: actor.userId,
      },
    });

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'billing.dispute.initiated',
      entity: 'BillingDispute',
      entityId: row.id,
      newValues: {
        invoiceId,
        status,
        lineCount: lines.length,
      } as Prisma.InputJsonValue,
    });

    return {
      id: row.id,
      status: row.status,
      lines,
    };
  }

  async list(actor: AuthUser, query: ListBillingDisputesQueryDto) {
    const take = Math.min(query.limit ?? 20, 100);
    const where: Prisma.BillingDisputeWhereInput = {
      institutionId: actor.institutionId,
      deletedAt: null,
    };
    if (query.status) {
      where.status = query.status;
    }
    const rows = await this.prisma.billingDispute.findMany({
      where,
      take: take + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        invoice: { select: { id: true, amount: true, status: true, isRetroactive: true } },
      },
    });
    let nextCursor: string | null = null;
    const data = rows.length > take ? rows.slice(0, take) : rows;
    if (rows.length > take) {
      nextCursor = data[data.length - 1]?.id ?? null;
    }
    const total = await this.prisma.billingDispute.count({ where });
    return {
      data: data.map((r) => ({
        id: r.id,
        status: r.status,
        reason: r.reason,
        lines: r.lines,
        resolutionNotes: r.resolutionNotes,
        createdAt: r.createdAt,
        invoice: r.invoice,
      })),
      nextCursor,
      total,
    };
  }

  async getById(actor: AuthUser, id: string) {
    const row = await this.prisma.billingDispute.findFirst({
      where: { id, institutionId: actor.institutionId, deletedAt: null },
      include: {
        invoice: true,
        creator: { select: { id: true, role: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Billing dispute not found');
    }
    return row;
  }

  async resolve(actor: AuthUser, id: string, dto: ResolveBillingDisputeDto) {
    assertDisputeResolve(actor);
    const row = await this.prisma.billingDispute.findFirst({
      where: { id, institutionId: actor.institutionId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Billing dispute not found');
    }
    if (
      row.status === BillingDisputeStatus.RESOLVED_ACCEPTED ||
      row.status === BillingDisputeStatus.RESOLVED_REJECTED
    ) {
      throw new BadRequestException('Dispute is already resolved');
    }

    const next =
      dto.resolution === 'ACCEPT'
        ? BillingDisputeStatus.RESOLVED_ACCEPTED
        : BillingDisputeStatus.RESOLVED_REJECTED;
    const notes = dto.notes?.trim() ?? null;

    await this.prisma.billingDispute.update({
      where: { id: row.id },
      data: { status: next, resolutionNotes: notes },
    });

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'billing.dispute.resolved',
      entity: 'BillingDispute',
      entityId: id,
      oldValues: { status: row.status } as Prisma.InputJsonValue,
      newValues: { status: next, notes } as Prisma.InputJsonValue,
    });

    return { ok: true as const, id, status: next };
  }
}
