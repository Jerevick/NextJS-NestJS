import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import { isEntityBillingExempt } from './entity-billing.util';

export type BillingEvidencePayload = {
  version: 1;
  institutionId: string;
  billingYear: number;
  billingMonth: number;
  generatedAt: string;
  minimumBillableCount: number | null;
  entities: Array<{
    entityId: string;
    entityCode: string;
    entityName: string;
    exempt: boolean;
    peakDailyCount: number;
    averageDailyCount: string;
    watermarkCount: number;
    billedCount: number;
    unitAmount: string;
    amount: string;
    dailySnapshots: Array<{ date: string; billableCount: number }>;
    studentIdsInPeriod: string[];
  }>;
  totals: { amount: string; currency: string };
};

@Injectable()
export class BillingEvidenceService {
  constructor(
    private readonly storage: ObjectStorageService,
    private readonly prisma: PrismaService,
  ) {}

  async buildAndUpload(params: {
    institutionId: string;
    year: number;
    month: number;
    minimumBillableCount: number | null;
    unit: Prisma.Decimal;
    currency: string;
    entitySummaries: Array<{
      entityId: string;
      entityCode: string;
      entityName: string;
      settings: unknown;
      peakDailyCount: number;
      averageDailyCount: Prisma.Decimal;
      watermarkCount: number;
    }>;
  }): Promise<{ evidenceS3Key: string; evidenceUrl: string }> {
    const m0 = params.month - 1;
    const rangeStart = new Date(Date.UTC(params.year, m0, 1, 0, 0, 0, 0));
    const rangeEnd = new Date(Date.UTC(params.year, m0 + 1, 0, 0, 0, 0, 0));
    const floor = params.minimumBillableCount ?? 0;

    const entities: BillingEvidencePayload['entities'] = [];
    let total = new Prisma.Decimal(0);

    for (const ent of params.entitySummaries) {
      const exempt = isEntityBillingExempt(ent.settings);
      const billedCount = exempt ? 0 : Math.max(ent.watermarkCount, floor);
      const amount = exempt ? new Prisma.Decimal(0) : new Prisma.Decimal(billedCount).mul(params.unit);
      total = total.add(amount);

      const dailySnapshots = await this.prisma.dailyBillableSnapshot.findMany({
        where: {
          institutionId: params.institutionId,
          entityId: ent.entityId,
          snapshotDate: { gte: rangeStart, lte: rangeEnd },
        },
        select: { snapshotDate: true, billableCount: true },
        orderBy: { snapshotDate: 'asc' },
      });

      const activeStudents = await this.prisma.student.findMany({
        where: {
          institutionId: params.institutionId,
          entityId: ent.entityId,
          enrollmentStatus: 'ACTIVE',
          deletedAt: null,
        },
        select: { id: true },
      });

      entities.push({
        entityId: ent.entityId,
        entityCode: ent.entityCode,
        entityName: ent.entityName,
        exempt,
        peakDailyCount: ent.peakDailyCount,
        averageDailyCount: ent.averageDailyCount.toString(),
        watermarkCount: ent.watermarkCount,
        billedCount,
        unitAmount: params.unit.toString(),
        amount: amount.toString(),
        dailySnapshots: dailySnapshots.map((d) => ({
          date: d.snapshotDate.toISOString().slice(0, 10),
          billableCount: d.billableCount,
        })),
        studentIdsInPeriod: activeStudents.map((s) => s.id),
      });
    }

    const payload: BillingEvidencePayload = {
      version: 1,
      institutionId: params.institutionId,
      billingYear: params.year,
      billingMonth: params.month,
      generatedAt: new Date().toISOString(),
      minimumBillableCount: params.minimumBillableCount,
      entities,
      totals: { amount: total.toString(), currency: params.currency },
    };

    const key = `billing/${params.institutionId}/${params.year}-${String(params.month).padStart(2, '0')}/evidence-${Date.now()}.json`;
    const stored = await this.storage.putJson(key, payload);
    return { evidenceS3Key: stored.key, evidenceUrl: stored.url };
  }

  getEvidenceDownloadUrl(evidenceS3Key: string | null): string | null {
    if (!evidenceS3Key) {
      return null;
    }
    return this.storage.getDownloadUrl(evidenceS3Key);
  }
}
