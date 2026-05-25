import { Injectable } from '@nestjs/common';
import { BillingDisputeStatus, InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InstitutionHealthService } from './institution-health.service';

@Injectable()
export class SuperAdminPlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly health: InstitutionHealthService,
  ) {}

  async getOverview() {
    const institutions = await this.prisma.institution.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        status: true,
        currentStudentCount: true,
        plan: true,
      },
    });

    const totalInstitutions = institutions.length;
    const totalBillableStudents = institutions.reduce((sum, i) => sum + i.currentStudentCount, 0);

    const openDisputes = await this.prisma.billingDispute.count({
      where: {
        deletedAt: null,
        status: { in: [BillingDisputeStatus.OPEN, BillingDisputeStatus.MANUAL_REVIEW] },
      },
    });

    const subs = await this.prisma.subscription.findMany({
      where: { deletedAt: null },
      select: { amount: true, billingCycle: true },
    });
    let estimatedMrr = new Prisma.Decimal(0);
    for (const s of subs) {
      if (s.billingCycle === 'MONTHLY') {
        estimatedMrr = estimatedMrr.add(s.amount);
      } else if (s.billingCycle === 'ANNUAL') {
        estimatedMrr = estimatedMrr.add(s.amount.div(12));
      }
    }

    const paidLast30 = await this.prisma.invoice.aggregate({
      where: {
        deletedAt: null,
        status: InvoiceStatus.PAID,
        paidAt: { gte: new Date(Date.now() - 30 * 86_400_000) },
      },
      _sum: { amount: true },
    });

    const anomalies: Array<{
      institutionId: string;
      name: string;
      dropPct: number;
    }> = [];
    for (const inst of institutions) {
      const a = await this.health.detectAnomalies(inst.id);
      if (a.alert) {
        anomalies.push({
          institutionId: inst.id,
          name: inst.name,
          dropPct: a.dropPct,
        });
      }
    }

    const healthScores = await Promise.all(
      institutions.map(async (i) => ({
        id: i.id,
        score: (await this.health.compute(i.id)).healthScore,
      })),
    );
    const avgHealth =
      healthScores.length > 0
        ? Math.round(healthScores.reduce((s, h) => s + h.score, 0) / healthScores.length)
        : 0;

    return {
      totalInstitutions,
      totalBillableStudents,
      openDisputes,
      estimatedMrr: estimatedMrr.toFixed(2),
      revenuePaidLast30Days: paidLast30._sum.amount?.toString() ?? '0',
      platformHealthScore: avgHealth,
      anomalies,
      institutionsByStatus: {
        active: institutions.filter((i) => i.status === 'ACTIVE').length,
        trial: institutions.filter((i) => i.status === 'TRIAL').length,
        suspended: institutions.filter((i) => i.status === 'SUSPENDED').length,
      },
    };
  }

  /** Last 12 calendar months of paid invoice revenue (USD) for super-admin MRR chart. */
  async getMrrTrend() {
    const months: { month: string; revenue: string; invoiceCount: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
      const agg = await this.prisma.invoice.aggregate({
        where: {
          deletedAt: null,
          status: InvoiceStatus.PAID,
          paidAt: { gte: start, lt: end },
        },
        _sum: { amount: true },
        _count: { _all: true },
      });
      const label = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
      months.push({
        month: label,
        revenue: agg._sum.amount?.toString() ?? '0',
        invoiceCount: agg._count._all,
      });
    }
    return { months };
  }

  /** Institution pins for world map (deterministic coords from id until geo fields exist). */
  async getInstitutionMapPins() {
    const rows = await this.prisma.institution.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, plan: true, status: true, currentStudentCount: true },
      take: 500,
    });
    return {
      pins: rows.map((r) => ({
        id: r.id,
        name: r.name,
        plan: r.plan,
        status: r.status,
        students: r.currentStudentCount,
        coordinates: pinCoordinatesFromId(r.id),
      })),
    };
  }
}

function pinCoordinatesFromId(id: string): { lat: number; lng: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  const lat = (h % 100) - 50 + ((h >> 8) % 100) / 100;
  const lng = ((h >> 16) % 300) - 150 + ((h >> 24) % 100) / 100;
  return { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 };
}
