import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type DailySnapshotRunSummary = {
  processedEntities: number;
  institutionsUpdated: number;
};

export type MonthlyBillableRollupResult = {
  institutionId: string;
  entityId: string;
  year: number;
  month: number;
  peakDailyCount: number;
  averageDailyCount: Prisma.Decimal;
  watermarkCount: number;
};

@Injectable()
export class BillingSnapshotService {
  private readonly logger = new Logger(BillingSnapshotService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Normalizes to UTC midnight for stable per-day snapshot keys. */
  utcStartOfDay(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  }

  /**
   * Writes one DailyBillableSnapshot row if missing for (institution, entity, day).
   * Locked rows are never overwritten. Existing unlocked rows are treated as write-once for the day.
   */
  async computeDailySnapshot(institutionId: string, entityId: string, day: Date): Promise<number> {
    const snapshotDate = this.utcStartOfDay(day);
    const existing = await this.prisma.dailyBillableSnapshot.findUnique({
      where: {
        institutionId_entityId_snapshotDate: { institutionId, entityId, snapshotDate },
      },
    });
    if (existing?.isLockedForBilling === true) {
      return existing.billableCount;
    }
    if (existing) {
      return existing.billableCount;
    }
    const billableCount = await this.prisma.student.count({
      where: {
        institutionId,
        entityId,
        enrollmentStatus: 'ACTIVE',
        deletedAt: null,
      },
    });
    await this.prisma.dailyBillableSnapshot.create({
      data: {
        institutionId,
        entityId,
        snapshotDate,
        billableCount,
      },
    });
    const yesterday = new Date(snapshotDate);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const prev = await this.prisma.dailyBillableSnapshot.findUnique({
      where: {
        institutionId_entityId_snapshotDate: { institutionId, entityId, snapshotDate: yesterday },
      },
    });
    if (prev && prev.billableCount > 0) {
      const delta = Math.abs(billableCount - prev.billableCount) / prev.billableCount;
      if (delta > 0.1) {
        this.logger.warn(
          `billing.headcount_anomaly institution=${institutionId} entity=${entityId} prev=${prev.billableCount} now=${billableCount} deltaPct=${(delta * 100).toFixed(1)}`,
        );
      }
    }
    return billableCount;
  }

  /**
   * Aggregates daily snapshots for a calendar month (UTC) into peak, average, and watermark
   * (max of peak vs rounded-up average). Upserts MonthlyBillableSummary.
   */
  async computeMonthlyBillable(
    institutionId: string,
    entityId: string,
    year: number,
    month: number,
  ): Promise<MonthlyBillableRollupResult> {
    const m0 = month - 1;
    const rangeStart = new Date(Date.UTC(year, m0, 1, 0, 0, 0, 0));
    const rangeEnd = new Date(Date.UTC(year, m0 + 1, 0, 0, 0, 0, 0));
    const rows = await this.prisma.dailyBillableSnapshot.findMany({
      where: {
        institutionId,
        entityId,
        snapshotDate: { gte: rangeStart, lte: rangeEnd },
      },
      select: { billableCount: true },
      orderBy: { snapshotDate: 'asc' },
    });
    let peakDailyCount = 0;
    let sum = 0;
    for (const r of rows) {
      peakDailyCount = Math.max(peakDailyCount, r.billableCount);
      sum += r.billableCount;
    }
    const count = rows.length;
    const averageNumeric = count > 0 ? sum / count : 0;
    const averageDailyCount = new Prisma.Decimal(averageNumeric.toFixed(4));
    const ceilAvg = count > 0 ? Math.ceil(averageNumeric - 1e-9) : 0;
    const watermarkCount = Math.max(peakDailyCount, ceilAvg);
    const saved = await this.prisma.monthlyBillableSummary.upsert({
      where: {
        institutionId_entityId_year_month: { institutionId, entityId, year, month },
      },
      create: {
        institutionId,
        entityId,
        year,
        month,
        peakDailyCount,
        averageDailyCount,
        watermarkCount,
      },
      update: {
        peakDailyCount,
        averageDailyCount,
        watermarkCount,
      },
    });
    return {
      institutionId: saved.institutionId,
      entityId: saved.entityId,
      year: saved.year,
      month: saved.month,
      peakDailyCount: saved.peakDailyCount,
      averageDailyCount: saved.averageDailyCount,
      watermarkCount: saved.watermarkCount,
    };
  }

  async runMonthlyRollupForInstitution(
    institutionId: string,
    year: number,
    month: number,
    entityId?: string,
  ): Promise<{ institutionsUpdated: number; entitiesProcessed: number }> {
    const entities = await this.prisma.institutionEntity.findMany({
      where: {
        institutionId,
        deletedAt: null,
        status: 'ACTIVE',
        ...(entityId ? { id: entityId } : {}),
      },
      select: { id: true },
    });
    for (const ent of entities) {
      await this.computeMonthlyBillable(institutionId, ent.id, year, month);
    }
    return { institutionsUpdated: 1, entitiesProcessed: entities.length };
  }

  /** Runs monthly rollup for every ACTIVE institution (platform cron). */
  async runAllInstitutionsForCalendarMonth(year: number, month: number): Promise<{
    institutionsUpdated: number;
    entitiesProcessed: number;
  }> {
    const institutions = await this.prisma.institution.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });
    let entitiesProcessed = 0;
    for (const inst of institutions) {
      const { entitiesProcessed: n } = await this.runMonthlyRollupForInstitution(inst.id, year, month);
      entitiesProcessed += n;
    }
    this.logger.log(
      `Monthly billable rollup: year=${year} month=${month} institutions=${institutions.length} entityRollups=${entitiesProcessed}`,
    );
    return { institutionsUpdated: institutions.length, entitiesProcessed };
  }

  async refreshInstitutionBillableHeadcount(institutionId: string): Promise<number> {
    const total = await this.prisma.student.count({
      where: {
        institutionId,
        enrollmentStatus: 'ACTIVE',
        deletedAt: null,
      },
    });
    await this.prisma.institution.update({
      where: { id: institutionId },
      data: { currentStudentCount: total },
    });
    return total;
  }

  /** Runs snapshots for every ACTIVE institution and ACTIVE entity (Phase 3.1 baseline). */
  async runAllInstitutionsForUtcDay(day: Date): Promise<DailySnapshotRunSummary> {
    const institutions = await this.prisma.institution.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });
    let processedEntities = 0;
    let institutionsUpdated = 0;
    for (const inst of institutions) {
      const n = await this.runForInstitution(inst.id, day);
      processedEntities += n.processedEntities;
      institutionsUpdated += 1;
    }
    this.logger.log(
      `Daily billable snapshots: institutions=${institutionsUpdated}, entitySnapshots=${processedEntities}`,
    );
    return { processedEntities, institutionsUpdated };
  }

  /** Snapshot all ACTIVE entities for one institution (tenant-scoped manual run). */
  async runForInstitution(institutionId: string, day: Date): Promise<DailySnapshotRunSummary> {
    const entities = await this.prisma.institutionEntity.findMany({
      where: { institutionId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });
    let processedEntities = 0;
    for (const ent of entities) {
      await this.computeDailySnapshot(institutionId, ent.id, day);
      processedEntities += 1;
    }
    await this.refreshInstitutionBillableHeadcount(institutionId);
    return { processedEntities, institutionsUpdated: 1 };
  }

  /**
   * Sets `isLockedForBilling` for every daily snapshot in the inclusive UTC day range.
   * Platform-only; callers must enforce super-admin permission and audit (.cursorrules LAW 11).
   */
  async setLockedForBillingInRange(params: {
    institutionId: string;
    entityId?: string;
    from: Date;
    to: Date;
    locked: boolean;
  }): Promise<{ updated: number }> {
    const fromDay = this.utcStartOfDay(params.from);
    const toDay = this.utcStartOfDay(params.to);
    if (fromDay.getTime() > toDay.getTime()) {
      throw new BadRequestException('fromDate must be on or before toDate');
    }
    const result = await this.prisma.dailyBillableSnapshot.updateMany({
      where: {
        institutionId: params.institutionId,
        ...(params.entityId ? { entityId: params.entityId } : {}),
        snapshotDate: { gte: fromDay, lte: toDay },
      },
      data: { isLockedForBilling: params.locked },
    });
    return { updated: result.count };
  }
}
