import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { BillingDisputeService } from '../billing/billing-dispute.service';
import { BillingInvoiceService } from '../billing/billing-invoice.service';
import { BillingSnapshotService } from '../billing/billing-snapshot.service';
import { PrismaService } from '../prisma/prisma.service';
import type { ResolveBillingDisputeDto } from '../billing/dto/resolve-billing-dispute.dto';
import type { LockDailySnapshotsDto } from '../billing/dto/lock-daily-snapshots.dto';

@Injectable()
export class SuperAdminBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly disputes: BillingDisputeService,
    private readonly invoices: BillingInvoiceService,
    private readonly snapshots: BillingSnapshotService,
    private readonly audit: AuditService,
  ) {}

  async listPendingDisputes(limit = 50) {
    const rows = await this.prisma.billingDispute.findMany({
      where: {
        deletedAt: null,
        status: { in: ['OPEN', 'MANUAL_REVIEW'] },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        institution: { select: { id: true, name: true, slug: true } },
        invoice: { select: { id: true, amount: true, status: true, isRetroactive: true } },
      },
    });
    return {
      data: rows.map((r) => ({
        id: r.id,
        status: r.status,
        reason: r.reason,
        lines: r.lines,
        createdAt: r.createdAt,
        institution: r.institution,
        invoice: {
          id: r.invoice.id,
          amount: r.invoice.amount.toString(),
          status: r.invoice.status,
          isRetroactive: r.invoice.isRetroactive,
        },
      })),
      total: rows.length,
    };
  }

  async resolveDispute(actor: AuthUser, id: string, dto: ResolveBillingDisputeDto) {
    return this.disputes.resolve(actor, id, dto);
  }

  async listInstitutionSnapshots(institutionId: string, year: number, month: number) {
    const inst = await this.prisma.institution.findFirst({
      where: { id: institutionId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!inst) {
      throw new NotFoundException('Institution not found');
    }
    const m0 = month - 1;
    const from = new Date(Date.UTC(year, m0, 1, 0, 0, 0, 0));
    const to = new Date(Date.UTC(year, m0 + 1, 0, 0, 0, 0, 0));
    const rows = await this.prisma.dailyBillableSnapshot.findMany({
      where: {
        institutionId,
        snapshotDate: { gte: from, lte: to },
      },
      include: { entity: { select: { code: true, name: true } } },
      orderBy: [{ snapshotDate: 'desc' }, { entityId: 'asc' }],
    });
    return {
      institution: inst,
      year,
      month,
      data: rows.map((r) => ({
        id: r.id,
        entityId: r.entityId,
        entity: r.entity,
        snapshotDate: r.snapshotDate,
        billableCount: r.billableCount,
        isLockedForBilling: r.isLockedForBilling,
      })),
    };
  }

  async amendSnapshot(
    actor: AuthUser,
    snapshotId: string,
    billableCount: number,
    reason: string,
  ) {
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      throw new BadRequestException('Amendment reason must be at least 10 characters');
    }
    const row = await this.prisma.dailyBillableSnapshot.findUnique({
      where: { id: snapshotId },
    });
    if (!row) {
      throw new NotFoundException('Snapshot not found');
    }
    if (row.isLockedForBilling) {
      throw new BadRequestException('Locked snapshots cannot be amended');
    }
    const updated = await this.prisma.dailyBillableSnapshot.update({
      where: { id: snapshotId },
      data: { billableCount },
    });
    this.audit.append({
      institutionId: row.institutionId,
      actorId: actor.userId,
      action: 'super_admin.billing.snapshot_amended',
      entity: 'DailyBillableSnapshot',
      entityId: snapshotId,
      oldValues: { billableCount: row.billableCount },
      newValues: { billableCount, reason: trimmed },
    });
    return updated;
  }

  async generateInvoiceForInstitution(
    actor: AuthUser,
    institutionId: string,
    year: number,
    month: number,
  ) {
    return this.invoices.generateDraftForInstitution(institutionId, year, month);
  }

  async lockSnapshots(actor: AuthUser, dto: LockDailySnapshotsDto) {
    const from = new Date(`${dto.fromDate}T00:00:00.000Z`);
    const to = new Date(`${dto.toDate}T00:00:00.000Z`);
    const { updated } = await this.snapshots.setLockedForBillingInRange({
      institutionId: dto.institutionId,
      entityId: dto.entityId?.trim() || undefined,
      from,
      to,
      locked: true,
    });
    this.audit.append({
      institutionId: dto.institutionId,
      actorId: actor.userId,
      action: 'super_admin.billing.snapshots.locked',
      entity: 'DailyBillableSnapshot',
      newValues: { ...dto, rowsUpdated: updated } as Prisma.InputJsonValue,
    });
    return { ok: true as const, updated };
  }
}
