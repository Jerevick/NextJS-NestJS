import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { BillingDisputeStatus, InvoiceStatus, Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { BillingEvidenceService } from './billing-evidence.service';
import { isEntityBillingExempt } from './entity-billing.util';
import { BillingJobsService } from './jobs/billing-jobs.service';
import { computeRetroactiveFeeAmount } from './retroactive-billing.util';
import { BillingSnapshotService } from './billing-snapshot.service';

function assertBillingWrite(actor: AuthUser): void {
  if (actor.permissions.includes('*') || actor.permissions.includes('billing.write')) {
    return;
  }
  throw new ForbiddenException('Missing billing.write permission');
}

export type DraftInvoiceLineItem = {
  kind: 'billing_period' | 'entity_watermark' | 'retroactive_backfill';
  year?: number;
  month?: number;
  entityId?: string;
  entityCode?: string;
  entityName?: string;
  peakDailyCount?: number;
  averageDailyCount?: string;
  watermarkCount?: number;
  billedCount?: number;
  unitAmount?: string;
  amount?: string;
};

@Injectable()
export class BillingInvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshots: BillingSnapshotService,
    private readonly evidence: BillingEvidenceService,
    @Optional() private readonly billingJobs?: BillingJobsService,
  ) {}

  private async loadInstitutionBilling(institutionId: string) {
    const inst = await this.prisma.institution.findFirst({
      where: { id: institutionId, deletedAt: null },
      select: {
        id: true,
        minimumBillableCount: true,
        disputeWindowDays: true,
      },
    });
    if (!inst) {
      throw new NotFoundException('Institution not found');
    }
    return inst;
  }

  private applyBillableFloor(watermarkCount: number, minimumBillableCount: number | null): number {
    const floor = minimumBillableCount ?? 0;
    return Math.max(watermarkCount, floor);
  }

  private defaultUnitUsd(): Prisma.Decimal {
    const raw = process.env.BILLING_DEFAULT_UNIT_USD?.trim();
    if (!raw) {
      return new Prisma.Decimal('12.00');
    }
    return new Prisma.Decimal(raw);
  }

  private async resolvePricing(
    institutionId: string,
  ): Promise<{ unit: Prisma.Decimal; currency: string }> {
    const sub = await this.prisma.subscription.findFirst({
      where: { institutionId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { amount: true, currency: true },
    });
    if (sub) {
      return { unit: sub.amount, currency: sub.currency };
    }
    return { unit: this.defaultUnitUsd(), currency: 'USD' };
  }

  private async loadBillableEntities(
    actor: AuthUser,
  ): Promise<Array<{ id: string; code: string; name: string }>> {
    const rows =
      actor.entityScope === 'ENTITY'
        ? await this.prisma.institutionEntity.findMany({
            where: {
              id: actor.entityId,
              institutionId: actor.institutionId,
              deletedAt: null,
              status: 'ACTIVE',
            },
            select: { id: true, code: true, name: true, settings: true },
          })
        : await this.prisma.institutionEntity.findMany({
            where: { institutionId: actor.institutionId, deletedAt: null, status: 'ACTIVE' },
            select: { id: true, code: true, name: true, settings: true },
            orderBy: { code: 'asc' },
          });
    if (actor.entityScope === 'ENTITY' && rows.length === 0) {
      throw new NotFoundException('Active entity not found for this user');
    }
    return rows
      .filter((e) => !isEntityBillingExempt(e.settings))
      .map((e) => ({ id: e.id, code: e.code, name: e.name }));
  }

  async estimateRetroactiveFee(params: {
    institutionId: string;
    entityId: string;
    fromDate: Date;
    toDate: Date;
  }): Promise<{
    inactiveDays: number;
    amount: string;
    currency: string;
    dailyRate: string;
    exempt: boolean;
  }> {
    if (params.fromDate > params.toDate) {
      throw new BadRequestException('fromDate must be on or before toDate');
    }
    const entity = await this.prisma.institutionEntity.findFirst({
      where: { id: params.entityId, institutionId: params.institutionId, deletedAt: null },
      select: { settings: true },
    });
    if (!entity) {
      throw new NotFoundException('Entity not found');
    }
    if (isEntityBillingExempt(entity.settings)) {
      const { unit, currency } = await this.resolvePricing(params.institutionId);
      return {
        inactiveDays: 0,
        amount: '0',
        currency,
        dailyRate: unit.div(30).toString(),
        exempt: true,
      };
    }
    const { unit, currency } = await this.resolvePricing(params.institutionId);
    const { inactiveDays, amount, dailyRate } = computeRetroactiveFeeAmount(
      params.fromDate,
      params.toDate,
      unit,
    );
    return {
      inactiveDays,
      amount: amount.toFixed(2),
      currency,
      dailyRate: dailyRate.toFixed(4),
      exempt: false,
    };
  }

  /**
   * Creates a retroactive DRAFT invoice when a backfill workflow completes.
   * Idempotent per backfillRequestId (returns existing invoice if already generated).
   */
  async generateRetroactiveInvoiceForBackfill(params: {
    institutionId: string;
    entityId: string;
    backfillRequestId: string;
    studentId: string;
    studentNumber: string;
    fromDate: Date;
    toDate: Date;
  }): Promise<{ invoiceId: string; amount: string; currency: string; skipped: boolean }> {
    const recentRetro = await this.prisma.invoice.findMany({
      where: {
        institutionId: params.institutionId,
        deletedAt: null,
        isRetroactive: true,
      },
      select: { id: true, amount: true, lineItems: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const existing = recentRetro.find((inv) => {
      const items = inv.lineItems;
      if (!Array.isArray(items)) {
        return false;
      }
      return items.some(
        (line) =>
          typeof line === 'object' &&
          line !== null &&
          'backfillRequestId' in line &&
          (line as { backfillRequestId?: string }).backfillRequestId === params.backfillRequestId,
      );
    });
    if (existing) {
      const { currency } = await this.resolvePricing(params.institutionId);
      return {
        invoiceId: existing.id,
        amount: existing.amount.toString(),
        currency,
        skipped: true,
      };
    }

    const estimate = await this.estimateRetroactiveFee({
      institutionId: params.institutionId,
      entityId: params.entityId,
      fromDate: params.fromDate,
      toDate: params.toDate,
    });
    const { currency } = await this.resolvePricing(params.institutionId);
    const amount = new Prisma.Decimal(estimate.amount);
    const dueDate = new Date();
    dueDate.setUTCDate(dueDate.getUTCDate() + 30);

    const lineItems: Prisma.InputJsonValue = [
      {
        kind: 'retroactive_backfill',
        backfillRequestId: params.backfillRequestId,
        studentId: params.studentId,
        studentNumber: params.studentNumber,
        entityId: params.entityId,
        fromDate: params.fromDate.toISOString(),
        toDate: params.toDate.toISOString(),
        inactiveDays: estimate.inactiveDays,
        dailyRate: estimate.dailyRate,
        amount: estimate.amount,
        exempt: estimate.exempt,
      },
    ];

    const lockedAt = new Date();
    const invoice = await this.prisma.invoice.create({
      data: {
        institutionId: params.institutionId,
        amount,
        status: InvoiceStatus.OPEN,
        dueDate,
        isRetroactive: true,
        backfillRequestId: params.backfillRequestId,
        lockedAt,
        lineItems,
      },
    });

    return {
      invoiceId: invoice.id,
      amount: invoice.amount.toString(),
      currency,
      skipped: false,
    };
  }

  /**
   * Locks a draft invoice after the dispute window (or when no open disputes remain).
   * Called by BullMQ lock-invoice processor.
   */
  async lockInvoiceAfterDisputeWindow(
    institutionId: string,
    invoiceId: string,
  ): Promise<{ status: 'locked' | 'skipped'; reason?: string }> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, institutionId, deletedAt: null },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (invoice.lockedAt) {
      return { status: 'skipped', reason: 'already_locked' };
    }
    if (invoice.status !== InvoiceStatus.DRAFT && invoice.status !== InvoiceStatus.OPEN) {
      return { status: 'skipped', reason: 'not_lockable_status' };
    }
    if (invoice.isRetroactive) {
      return { status: 'skipped', reason: 'retroactive_immediate_lock' };
    }

    const inst = await this.loadInstitutionBilling(institutionId);
    const createdAt = invoice.createdAt.getTime();
    const windowMs = inst.disputeWindowDays * 86_400_000;
    if (Date.now() < createdAt + windowMs) {
      return { status: 'skipped', reason: 'dispute_window_open' };
    }

    const openDispute = await this.prisma.billingDispute.findFirst({
      where: {
        invoiceId,
        deletedAt: null,
        status: {
          in: [BillingDisputeStatus.OPEN, BillingDisputeStatus.MANUAL_REVIEW],
        },
      },
      select: { id: true },
    });
    if (openDispute) {
      return { status: 'skipped', reason: 'open_dispute' };
    }

    const lockedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: InvoiceStatus.OPEN, lockedAt },
      });

      const period = this.periodFromLineItems(invoice.lineItems);
      if (period) {
        const m0 = period.month - 1;
        const from = new Date(Date.UTC(period.year, m0, 1, 0, 0, 0, 0));
        const to = new Date(Date.UTC(period.year, m0 + 1, 0, 0, 0, 0, 0));
        await tx.dailyBillableSnapshot.updateMany({
          where: {
            institutionId,
            snapshotDate: { gte: from, lte: to },
          },
          data: { isLockedForBilling: true },
        });
      }
    });

    return { status: 'locked' };
  }

  private periodFromLineItems(lineItems: unknown): { year: number; month: number } | null {
    if (!Array.isArray(lineItems)) {
      return null;
    }
    const header = lineItems.find(
      (l) =>
        typeof l === 'object' &&
        l !== null &&
        'kind' in l &&
        (l as { kind?: string }).kind === 'billing_period',
    ) as { year?: number; month?: number } | undefined;
    if (!header?.year || !header?.month) {
      return null;
    }
    return { year: header.year, month: header.month };
  }

  /**
   * Rolls up daily snapshots into MonthlyBillableSummary rows, then creates one DRAFT invoice
   * with per-entity line items priced as watermarkCount × subscription unit (or BILLING_DEFAULT_UNIT_USD).
   */
  async generateDraftInvoice(
    actor: AuthUser,
    year: number,
    month: number,
    isRetroactive = false,
  ): Promise<{
    invoiceId: string;
    amount: string;
    currency: string;
    lineItems: DraftInvoiceLineItem[];
    evidenceS3Key: string;
    evidenceDownloadUrl: string | null;
  }> {
    assertBillingWrite(actor);
    const inst = await this.loadInstitutionBilling(actor.institutionId);
    const { unit, currency } = await this.resolvePricing(actor.institutionId);
    const entityRows =
      actor.entityScope === 'ENTITY'
        ? await this.prisma.institutionEntity.findMany({
            where: {
              id: actor.entityId,
              institutionId: actor.institutionId,
              deletedAt: null,
              status: 'ACTIVE',
            },
            select: { id: true, code: true, name: true, settings: true },
          })
        : await this.prisma.institutionEntity.findMany({
            where: { institutionId: actor.institutionId, deletedAt: null, status: 'ACTIVE' },
            select: { id: true, code: true, name: true, settings: true },
            orderBy: { code: 'asc' },
          });
    if (actor.entityScope === 'ENTITY' && entityRows.length === 0) {
      throw new NotFoundException('Active entity not found for this user');
    }

    const lineItems: DraftInvoiceLineItem[] = [{ kind: 'billing_period', year, month }];
    let total = new Prisma.Decimal(0);
    const summariesForEvidence: Array<{
      entityId: string;
      entityCode: string;
      entityName: string;
      settings: unknown;
      peakDailyCount: number;
      averageDailyCount: Prisma.Decimal;
      watermarkCount: number;
    }> = [];

    for (const ent of entityRows) {
      if (isEntityBillingExempt(ent.settings)) {
        continue;
      }
      const summary = await this.snapshots.computeMonthlyBillable(
        actor.institutionId,
        ent.id,
        year,
        month,
      );
      const billedCount = this.applyBillableFloor(
        summary.watermarkCount,
        inst.minimumBillableCount,
      );
      const lineAmount = new Prisma.Decimal(billedCount).mul(unit);
      total = total.add(lineAmount);
      summariesForEvidence.push({
        entityId: ent.id,
        entityCode: ent.code,
        entityName: ent.name,
        settings: ent.settings,
        peakDailyCount: summary.peakDailyCount,
        averageDailyCount: summary.averageDailyCount,
        watermarkCount: summary.watermarkCount,
      });
      lineItems.push({
        kind: 'entity_watermark',
        entityId: ent.id,
        entityCode: ent.code,
        entityName: ent.name,
        peakDailyCount: summary.peakDailyCount,
        averageDailyCount: summary.averageDailyCount.toString(),
        watermarkCount: summary.watermarkCount,
        billedCount,
        unitAmount: unit.toString(),
        amount: lineAmount.toString(),
      });
    }

    const m0 = month - 1;
    const dueDate = new Date(Date.UTC(year, m0 + 1, 15, 0, 0, 0, 0));

    const { evidenceS3Key } = await this.evidence.buildAndUpload({
      institutionId: actor.institutionId,
      year,
      month,
      minimumBillableCount: inst.minimumBillableCount,
      unit,
      currency,
      entitySummaries: summariesForEvidence,
    });

    const invoice = await this.prisma.invoice.create({
      data: {
        institutionId: actor.institutionId,
        amount: total,
        status: InvoiceStatus.DRAFT,
        dueDate,
        isRetroactive,
        evidenceS3Key,
        lineItems: lineItems as unknown as Prisma.InputJsonValue,
      },
    });

    if (!isRetroactive && this.billingJobs) {
      const delayMs = inst.disputeWindowDays * 86_400_000;
      await this.billingJobs.scheduleLockInvoice(invoice.id, actor.institutionId, delayMs);
    }

    return {
      invoiceId: invoice.id,
      amount: invoice.amount.toString(),
      currency,
      lineItems,
      evidenceS3Key,
      evidenceDownloadUrl: await this.evidence.getEvidenceDownloadUrl(evidenceS3Key),
    };
  }

  /** Platform-triggered draft invoice for a tenant (super-admin). */
  async generateDraftForInstitution(
    institutionId: string,
    year: number,
    month: number,
  ): Promise<{
    invoiceId: string;
    amount: string;
    currency: string;
  }> {
    const main = await this.prisma.institutionEntity.findFirst({
      where: { institutionId, deletedAt: null, status: 'ACTIVE', code: 'MAIN' },
      select: { id: true },
    });
    const pseudoActor: AuthUser = {
      userId: 'platform-billing',
      email: 'billing@unicore.internal',
      role: 'SUPER_ADMIN',
      institutionId,
      entityId: main?.id ?? institutionId,
      entityScope: 'ALL',
      permissions: ['*', 'billing.write'],
    };
    const result = await this.generateDraftInvoice(pseudoActor, year, month, false);
    return {
      invoiceId: result.invoiceId,
      amount: result.amount,
      currency: result.currency,
    };
  }
}
