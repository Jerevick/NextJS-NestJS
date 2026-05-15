import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import type { ListBillingQueryDto } from './dto/list-billing-query.dto';
import type { ListSnapshotsQueryDto } from './dto/list-snapshots-query.dto';
import { BillingRepository } from './billing.repository';
import { BillingEvidenceService } from './billing-evidence.service';
import { BillingInvoiceService } from './billing-invoice.service';
import { BillingSnapshotService } from './billing-snapshot.service';
import type { FinalizeInvoiceDto } from './dto/finalize-invoice.dto';
import type { GenerateDraftInvoiceDto } from './dto/generate-draft-invoice.dto';
import type { ListMonthlySummariesQueryDto } from './dto/list-monthly-summaries-query.dto';
import type { LockDailySnapshotsDto } from './dto/lock-daily-snapshots.dto';
import type { BillingImpactQueryDto } from './dto/billing-impact-query.dto';
import type { MonthlyPeriodDto } from './dto/monthly-period.dto';
import { PrismaService } from '../prisma/prisma.service';

function assertBillingRead(actor: AuthUser) {
  if (
    actor.permissions.includes('*') ||
    actor.permissions.includes('billing.read') ||
    actor.permissions.includes('billing.write') ||
    actor.permissions.includes('institutions.read') ||
    actor.permissions.includes('institutions.write')
  ) {
    return;
  }
  throw new ForbiddenException('Missing billing or institutions read permission');
}

function assertBillingWrite(actor: AuthUser) {
  if (actor.permissions.includes('*') || actor.permissions.includes('billing.write')) {
    return;
  }
  throw new ForbiddenException('Missing billing.write permission');
}

function serializeAmount(v: { toString(): string }) {
  return v.toString();
}

function assertPlatformSuperAdmin(actor: AuthUser): void {
  if (actor.permissions.includes('*')) {
    return;
  }
  throw new ForbiddenException('Only platform super administrators may lock or unlock billing snapshots.');
}

function parseUtcDayOnly(isoDay: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay.trim());
  if (!m) {
    throw new BadRequestException('Date must be YYYY-MM-DD');
  }
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo, d, 0, 0, 0, 0));
}

export type BillingRequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class BillingService {
  constructor(
    private readonly repo: BillingRepository,
    private readonly snapshots: BillingSnapshotService,
    private readonly invoices: BillingInvoiceService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly evidence: BillingEvidenceService,
  ) {}

  async getOverview(actor: AuthUser) {
    assertBillingRead(actor);
    const institution = await this.repo.findInstitutionBillingHeadline(actor.institutionId);
    if (!institution) {
      throw new NotFoundException('Institution not found');
    }

    const today = this.snapshots.utcStartOfDay(new Date());
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    const entityFilter =
      actor.entityScope === 'ENTITY' ? { entityId: actor.entityId } : {};

    const [todaySnaps, yesterdaySnaps, inactiveCount] = await Promise.all([
      this.repo.sumDailySnapshotBillable(actor.institutionId, today, entityFilter),
      this.repo.sumDailySnapshotBillable(actor.institutionId, yesterday, entityFilter),
      this.repo.countStudentsByStatus(actor.institutionId, 'INACTIVE', entityFilter),
    ]);

    const billableToday =
      todaySnaps > 0
        ? todaySnaps
        : await this.repo.countStudentsByStatus(actor.institutionId, 'ACTIVE', entityFilter);

    const billableYesterday = yesterdaySnaps > 0 ? yesterdaySnaps : billableToday;
    const delta = billableToday - billableYesterday;
    const deltaPct =
      billableYesterday > 0
        ? Number(((delta / billableYesterday) * 100).toFixed(1))
        : billableToday > 0
          ? null
          : 0;

    const now = new Date();
    const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const year = prevMonth.getUTCFullYear();
    const month = prevMonth.getUTCMonth() + 1;
    const watermarkSum = await this.repo.sumMonthlyWatermarks(
      actor.institutionId,
      year,
      month,
      entityFilter,
    );

    return {
      billableToday,
      billableYesterday,
      dayOverDayDelta: delta,
      dayOverDayDeltaPct: deltaPct,
      inactiveStudentCount: inactiveCount,
      institutionCurrentStudentCount: institution.currentStudentCount,
      previousMonthWatermarkSum: watermarkSum,
      previousMonth: { year, month },
    };
  }

  async getBillingImpactReport(actor: AuthUser, query: BillingImpactQueryDto) {
    assertBillingRead(actor);
    const to = query.toDate ? parseUtcDayOnly(query.toDate) : new Date();
    const from = query.fromDate
      ? parseUtcDayOnly(query.fromDate)
      : new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1, 0, 0, 0, 0));
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('fromDate must be on or before toDate');
    }
    const entityId = actor.entityScope === 'ENTITY' ? actor.entityId : undefined;
    const rows = await this.prisma.statusChangeLog.findMany({
      where: {
        institutionId: actor.institutionId,
        recordedAt: { gte: from, lte: to },
        ...(entityId ? { entityId } : {}),
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

  async listSubscriptions(actor: AuthUser, query: ListBillingQueryDto) {
    assertBillingRead(actor);
    const limit = query.limit ?? 20;
    const where = { institutionId: actor.institutionId, deletedAt: null };
    const rows = await this.repo.findSubscriptionsPage(where, limit, query.cursor);
    let nextCursor: string | undefined;
    if (rows.length > limit) {
      const last = rows.pop();
      nextCursor = last?.id;
    }
    const total = await this.repo.countSubscriptions(where);
    return {
      data: rows.map((r) => ({
        id: r.id,
        institutionId: r.institutionId,
        planId: r.planId,
        billingCycle: r.billingCycle,
        amount: serializeAmount(r.amount),
        currency: r.currency,
        nextBillingDate: r.nextBillingDate,
        stripeSubscriptionId: r.stripeSubscriptionId,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      nextCursor,
      total,
    };
  }

  async getSubscription(actor: AuthUser, id: string) {
    assertBillingRead(actor);
    const row = await this.repo.findSubscription(actor.institutionId, id);
    if (!row) {
      throw new NotFoundException('Subscription not found');
    }
    return {
      id: row.id,
      institutionId: row.institutionId,
      planId: row.planId,
      billingCycle: row.billingCycle,
      amount: serializeAmount(row.amount),
      currency: row.currency,
      nextBillingDate: row.nextBillingDate,
      stripeSubscriptionId: row.stripeSubscriptionId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async listInvoices(actor: AuthUser, query: ListBillingQueryDto) {
    assertBillingRead(actor);
    const limit = query.limit ?? 20;
    const where = { institutionId: actor.institutionId, deletedAt: null };
    const rows = await this.repo.findInvoicesPage(where, limit, query.cursor);
    let nextCursor: string | undefined;
    if (rows.length > limit) {
      const last = rows.pop();
      nextCursor = last?.id;
    }
    const total = await this.repo.countInvoices(where);
    return {
      data: rows.map((r) => ({
        id: r.id,
        institutionId: r.institutionId,
        amount: serializeAmount(r.amount),
        status: r.status,
        dueDate: r.dueDate,
        paidAt: r.paidAt,
        lockedAt: r.lockedAt,
        isRetroactive: r.isRetroactive,
        lineItems: r.lineItems,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      nextCursor,
      total,
    };
  }

  async getInvoice(actor: AuthUser, id: string) {
    assertBillingRead(actor);
    const row = await this.repo.findInvoice(actor.institutionId, id);
    if (!row) {
      throw new NotFoundException('Invoice not found');
    }
    return {
      id: row.id,
      institutionId: row.institutionId,
      amount: serializeAmount(row.amount),
      status: row.status,
      dueDate: row.dueDate,
      paidAt: row.paidAt,
      lockedAt: row.lockedAt,
      isRetroactive: row.isRetroactive,
      evidenceS3Key: row.evidenceS3Key,
      evidenceDownloadUrl: this.evidence.getEvidenceDownloadUrl(row.evidenceS3Key),
      backfillRequestId: row.backfillRequestId,
      lineItems: row.lineItems,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async listDailySnapshots(actor: AuthUser, query: ListSnapshotsQueryDto) {
    assertBillingRead(actor);
    const limit = query.limit ?? 20;
    const where: Prisma.DailyBillableSnapshotWhereInput = {
      institutionId: actor.institutionId,
    };
    if (actor.entityScope === 'ENTITY') {
      where.entityId = actor.entityId;
    } else if (query.entityId?.trim()) {
      where.entityId = query.entityId.trim();
    }
    const rows = await this.repo.findSnapshotsPage(where, limit, query.cursor);
    let nextCursor: string | undefined;
    if (rows.length > limit) {
      const last = rows.pop();
      nextCursor = last?.id;
    }
    const total = await this.repo.countSnapshots(where);
    return {
      data: rows.map((r) => ({
        id: r.id,
        institutionId: r.institutionId,
        entityId: r.entityId,
        entity: r.entity,
        snapshotDate: r.snapshotDate,
        billableCount: r.billableCount,
        isLockedForBilling: r.isLockedForBilling,
        createdAt: r.createdAt,
      })),
      nextCursor,
      total,
    };
  }

  async runDailySnapshotsNow(actor: AuthUser) {
    assertBillingWrite(actor);
    if (actor.permissions.includes('*')) {
      return { ok: true as const, ...(await this.snapshots.runAllInstitutionsForUtcDay(new Date())) };
    }
    return { ok: true as const, ...(await this.snapshots.runForInstitution(actor.institutionId, new Date())) };
  }

  async listMonthlySummaries(actor: AuthUser, query: ListMonthlySummariesQueryDto) {
    assertBillingRead(actor);
    const limit = query.limit ?? 20;
    const where: Prisma.MonthlyBillableSummaryWhereInput = {
      institutionId: actor.institutionId,
      year: query.year,
      month: query.month,
    };
    if (actor.entityScope === 'ENTITY') {
      where.entityId = actor.entityId;
    } else if (query.entityId?.trim()) {
      where.entityId = query.entityId.trim();
    }
    const rows = await this.repo.findMonthlySummariesPage(where, limit, query.cursor);
    let nextCursor: string | undefined;
    if (rows.length > limit) {
      const last = rows.pop();
      nextCursor = last?.id;
    }
    const total = await this.repo.countMonthlySummaries(where);
    return {
      data: rows.map((r) => ({
        id: r.id,
        institutionId: r.institutionId,
        entityId: r.entityId,
        entity: r.entity,
        year: r.year,
        month: r.month,
        peakDailyCount: r.peakDailyCount,
        averageDailyCount: r.averageDailyCount.toString(),
        watermarkCount: r.watermarkCount,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      nextCursor,
      total,
    };
  }

  async computeMonthlyRollup(actor: AuthUser, dto: MonthlyPeriodDto) {
    assertBillingWrite(actor);
    const entityFilter = actor.entityScope === 'ENTITY' ? actor.entityId : undefined;
    if (actor.permissions.includes('*')) {
      return {
        ok: true as const,
        ...(await this.snapshots.runAllInstitutionsForCalendarMonth(dto.year, dto.month)),
      };
    }
    return {
      ok: true as const,
      ...(await this.snapshots.runMonthlyRollupForInstitution(
        actor.institutionId,
        dto.year,
        dto.month,
        entityFilter,
      )),
    };
  }

  async generateDraftInvoice(actor: AuthUser, dto: GenerateDraftInvoiceDto) {
    assertBillingWrite(actor);
    return this.invoices.generateDraftInvoice(actor, dto.year, dto.month, dto.isRetroactive === true);
  }

  async lockDailySnapshots(actor: AuthUser, dto: LockDailySnapshotsDto, meta?: BillingRequestMeta) {
    assertPlatformSuperAdmin(actor);
    const instOk = await this.repo.countInstitutions({ id: dto.institutionId, deletedAt: null });
    if (instOk === 0) {
      throw new NotFoundException('Institution not found');
    }
    if (dto.entityId?.trim()) {
      const entOk = await this.repo.countEntities({
        id: dto.entityId.trim(),
        institutionId: dto.institutionId,
        deletedAt: null,
      });
      if (entOk === 0) {
        throw new BadRequestException('entityId does not belong to this institution');
      }
    }
    const from = parseUtcDayOnly(dto.fromDate);
    const to = parseUtcDayOnly(dto.toDate);
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
      action: 'billing.snapshots.locked',
      entity: 'DailyBillableSnapshot',
      newValues: {
        fromDate: dto.fromDate,
        toDate: dto.toDate,
        entityId: dto.entityId?.trim() ?? null,
        rowsUpdated: updated,
        reason: dto.reason,
      },
      ipAddress: meta?.ipAddress ?? null,
      userAgent: meta?.userAgent ?? null,
    });
    return { ok: true as const, updated };
  }

  async unlockDailySnapshots(actor: AuthUser, dto: LockDailySnapshotsDto, meta?: BillingRequestMeta) {
    assertPlatformSuperAdmin(actor);
    const instOk = await this.repo.countInstitutions({ id: dto.institutionId, deletedAt: null });
    if (instOk === 0) {
      throw new NotFoundException('Institution not found');
    }
    if (dto.entityId?.trim()) {
      const entOk = await this.repo.countEntities({
        id: dto.entityId.trim(),
        institutionId: dto.institutionId,
        deletedAt: null,
      });
      if (entOk === 0) {
        throw new BadRequestException('entityId does not belong to this institution');
      }
    }
    const from = parseUtcDayOnly(dto.fromDate);
    const to = parseUtcDayOnly(dto.toDate);
    const { updated } = await this.snapshots.setLockedForBillingInRange({
      institutionId: dto.institutionId,
      entityId: dto.entityId?.trim() || undefined,
      from,
      to,
      locked: false,
    });
    this.audit.append({
      institutionId: dto.institutionId,
      actorId: actor.userId,
      action: 'billing.snapshots.unlocked',
      entity: 'DailyBillableSnapshot',
      newValues: {
        fromDate: dto.fromDate,
        toDate: dto.toDate,
        entityId: dto.entityId?.trim() ?? null,
        rowsUpdated: updated,
        reason: dto.reason,
      },
      ipAddress: meta?.ipAddress ?? null,
      userAgent: meta?.userAgent ?? null,
    });
    return { ok: true as const, updated };
  }

  async finalizeInvoice(actor: AuthUser, id: string, dto: FinalizeInvoiceDto, meta?: BillingRequestMeta) {
    assertBillingWrite(actor);
    const row = await this.repo.findInvoice(actor.institutionId, id);
    if (!row) {
      throw new NotFoundException('Invoice not found');
    }
    if (row.status !== 'DRAFT' || row.lockedAt != null) {
      throw new BadRequestException('Only draft invoices that are not yet issued can be finalized');
    }
    const result = await this.repo.finalizeDraftInvoice(actor.institutionId, id);
    if (result.count === 0) {
      throw new NotFoundException('Invoice not found or not in draft state');
    }
    const lockedAt = new Date();
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'billing.invoice.finalized',
      entity: 'Invoice',
      entityId: id,
      oldValues: { status: row.status },
      newValues: {
        status: 'OPEN',
        lockedAt: lockedAt.toISOString(),
        reason: dto.reason ?? null,
      },
      ipAddress: meta?.ipAddress ?? null,
      userAgent: meta?.userAgent ?? null,
    });
    return { ok: true as const, id, status: 'OPEN' as const, lockedAt };
  }
}
