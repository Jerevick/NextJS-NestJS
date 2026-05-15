import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSubscriptionsPage(where: Prisma.SubscriptionWhereInput, take: number, cursor?: string) {
    return this.prisma.subscription.findMany({
      where,
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  countSubscriptions(where: Prisma.SubscriptionWhereInput) {
    return this.prisma.subscription.count({ where });
  }

  findSubscription(institutionId: string, id: string) {
    return this.prisma.subscription.findFirst({
      where: { id, institutionId, deletedAt: null },
    });
  }

  findInvoicesPage(where: Prisma.InvoiceWhereInput, take: number, cursor?: string) {
    return this.prisma.invoice.findMany({
      where,
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  countInvoices(where: Prisma.InvoiceWhereInput) {
    return this.prisma.invoice.count({ where });
  }

  findInvoice(institutionId: string, id: string) {
    return this.prisma.invoice.findFirst({
      where: { id, institutionId, deletedAt: null },
    });
  }

  finalizeDraftInvoice(institutionId: string, id: string) {
    return this.prisma.invoice.updateMany({
      where: {
        id,
        institutionId,
        deletedAt: null,
        status: 'DRAFT',
        lockedAt: null,
      },
      data: {
        status: 'OPEN',
        lockedAt: new Date(),
      },
    });
  }

  findSnapshotsPage(where: Prisma.DailyBillableSnapshotWhereInput, take: number, cursor?: string) {
    return this.prisma.dailyBillableSnapshot.findMany({
      where,
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ snapshotDate: 'desc' }, { id: 'desc' }],
      include: {
        entity: { select: { id: true, code: true, name: true } },
      },
    });
  }

  countSnapshots(where: Prisma.DailyBillableSnapshotWhereInput) {
    return this.prisma.dailyBillableSnapshot.count({ where });
  }

  findMonthlySummariesPage(
    where: Prisma.MonthlyBillableSummaryWhereInput,
    take: number,
    cursor?: string,
  ) {
    return this.prisma.monthlyBillableSummary.findMany({
      where,
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { entityId: 'asc' }, { id: 'desc' }],
      include: {
        entity: { select: { id: true, code: true, name: true } },
      },
    });
  }

  countMonthlySummaries(where: Prisma.MonthlyBillableSummaryWhereInput) {
    return this.prisma.monthlyBillableSummary.count({ where });
  }

  countInstitutions(where: Prisma.InstitutionWhereInput) {
    return this.prisma.institution.count({ where });
  }

  countEntities(where: Prisma.InstitutionEntityWhereInput) {
    return this.prisma.institutionEntity.count({ where });
  }

  findInstitutionBillingHeadline(institutionId: string) {
    return this.prisma.institution.findFirst({
      where: { id: institutionId, deletedAt: null },
      select: { id: true, currentStudentCount: true },
    });
  }

  async sumDailySnapshotBillable(
    institutionId: string,
    snapshotDate: Date,
    scope: { entityId?: string },
  ): Promise<number> {
    const agg = await this.prisma.dailyBillableSnapshot.aggregate({
      where: {
        institutionId,
        snapshotDate,
        ...(scope.entityId ? { entityId: scope.entityId } : {}),
      },
      _sum: { billableCount: true },
    });
    return agg._sum.billableCount ?? 0;
  }

  countStudentsByStatus(
    institutionId: string,
    status: 'ACTIVE' | 'INACTIVE',
    scope: { entityId?: string },
  ) {
    return this.prisma.student.count({
      where: {
        institutionId,
        enrollmentStatus: status,
        deletedAt: null,
        ...(scope.entityId ? { entityId: scope.entityId } : {}),
      },
    });
  }

  async sumMonthlyWatermarks(
    institutionId: string,
    year: number,
    month: number,
    scope: { entityId?: string },
  ): Promise<number> {
    const rows = await this.prisma.monthlyBillableSummary.findMany({
      where: {
        institutionId,
        year,
        month,
        ...(scope.entityId ? { entityId: scope.entityId } : {}),
      },
      select: { watermarkCount: true },
    });
    return rows.reduce((sum, r) => sum + r.watermarkCount, 0);
  }
}
