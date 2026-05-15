import { Injectable } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type InstitutionHealthBreakdown = {
  paymentScore: number;
  loginActivityScore: number;
  featureUsageScore: number;
  dataCompletenessScore: number;
  healthScore: number;
};

@Injectable()
export class InstitutionHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async compute(institutionId: string): Promise<InstitutionHealthBreakdown> {
    const inst = await this.prisma.institution.findFirst({
      where: { id: institutionId, deletedAt: null },
      select: {
        id: true,
        status: true,
        currentStudentCount: true,
        maxStudents: true,
        modules: { where: { deletedAt: null, enabled: true }, select: { module: true } },
        _count: {
          select: {
            institutionEntities: { where: { deletedAt: null, status: 'ACTIVE' } },
            students: { where: { deletedAt: null } },
            orgUnits: { where: { deletedAt: null } },
            users: { where: { deletedAt: null } },
          },
        },
      },
    });
    if (!inst) {
      return {
        paymentScore: 0,
        loginActivityScore: 0,
        featureUsageScore: 0,
        dataCompletenessScore: 0,
        healthScore: 0,
      };
    }

    if (inst.status === 'SUSPENDED') {
      return {
        paymentScore: 10,
        loginActivityScore: 10,
        featureUsageScore: 10,
        dataCompletenessScore: 10,
        healthScore: 10,
      };
    }

    const sub = await this.prisma.subscription.findFirst({
      where: { institutionId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    const overdue = await this.prisma.invoice.count({
      where: {
        institutionId,
        deletedAt: null,
        status: InvoiceStatus.OPEN,
        dueDate: { lt: new Date() },
      },
    });
    let paymentScore = 50;
    if (sub) {
      paymentScore = overdue > 0 ? 40 : 100;
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
    const totalUsers = inst._count.users;
    const activeLogins = await this.prisma.user.count({
      where: {
        institutionId,
        deletedAt: null,
        lastLoginAt: { gte: thirtyDaysAgo },
      },
    });
    const loginActivityScore =
      totalUsers === 0 ? 50 : Math.min(100, Math.round((activeLogins / totalUsers) * 100));

    const enabledModules = inst.modules.length;
    const featureUsageScore = Math.min(100, enabledModules * 25);

    let dataCompletenessScore = 0;
    if (inst._count.institutionEntities > 0) {
      dataCompletenessScore += 35;
    }
    if (inst._count.orgUnits > 0) {
      dataCompletenessScore += 35;
    }
    if (inst._count.students > 0) {
      dataCompletenessScore += 30;
    }

    const healthScore = Math.round(
      paymentScore * 0.3 +
        loginActivityScore * 0.3 +
        featureUsageScore * 0.2 +
        dataCompletenessScore * 0.2,
    );

    return {
      paymentScore,
      loginActivityScore,
      featureUsageScore,
      dataCompletenessScore,
      healthScore,
    };
  }

  async detectAnomalies(institutionId: string): Promise<{ dropPct: number; alert: boolean }> {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
    const snapshots = await this.prisma.dailyBillableSnapshot.findMany({
      where: {
        institutionId,
        snapshotDate: { gte: weekAgo },
      },
      select: { snapshotDate: true, billableCount: true },
      orderBy: { snapshotDate: 'asc' },
    });
    if (snapshots.length < 2) {
      return { dropPct: 0, alert: false };
    }
    const byDay = new Map<string, number>();
    for (const s of snapshots) {
      const key = s.snapshotDate.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + s.billableCount);
    }
    const totals = [...byDay.values()];
    const first = totals[0] ?? 0;
    const last = totals[totals.length - 1] ?? 0;
    if (first <= 0) {
      return { dropPct: 0, alert: false };
    }
    const dropPct = ((first - last) / first) * 100;
    return { dropPct: Math.round(dropPct * 10) / 10, alert: dropPct > 10 };
  }
}
