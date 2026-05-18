import { Injectable, NotFoundException } from '@nestjs/common';
import { StudentEnrollmentStatusEnum } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from './ai.service';

export type WeeklyAnalyticsContext = {
  period: { from: string; to: string; label: string };
  scope: 'institution-wide' | 'entity';
  entityId?: string;
  entityName?: string;
  totals: {
    students: number;
    activeStudents: number;
    staff: number;
    meetings: number;
  };
  billing: Array<{
    entityId: string;
    entityName: string;
    latestBillable: number;
    avg7Day: number;
    avg30Day: number;
    weekDeltaPct: number | null;
  }>;
  enrollmentMix: Record<string, number>;
};

@Injectable()
export class AiAdminAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async buildWeeklyContext(
    institutionId: string,
    entityId?: string,
  ): Promise<WeeklyAnalyticsContext> {
    const inst = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { name: true },
    });
    if (!inst) throw new NotFoundException('Institution not found');

    const to = new Date();
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - 7);

    const entityFilter = entityId ? { entityId } : {};
    const entities = await this.prisma.institutionEntity.findMany({
      where: { institutionId, deletedAt: null, ...(entityId ? { id: entityId } : {}) },
      select: { id: true, name: true, code: true },
    });
    if (entityId && entities.length === 0) {
      throw new NotFoundException('Entity not found');
    }

    const since30 = new Date(to);
    since30.setUTCDate(since30.getUTCDate() - 30);

    const snapshots = await this.prisma.dailyBillableSnapshot.findMany({
      where: {
        institutionId,
        snapshotDate: { gte: since30 },
        ...(entityId ? { entityId } : {}),
      },
      orderBy: { snapshotDate: 'asc' },
    });

    const billing = entities.map((ent) => {
      const rows = snapshots.filter((s) => s.entityId === ent.id);
      const latest = rows[rows.length - 1]?.billableCount ?? 0;
      const last7 = rows.slice(-7);
      const avg7 = last7.length ? last7.reduce((s, r) => s + r.billableCount, 0) / last7.length : 0;
      const avg30 = rows.length ? rows.reduce((s, r) => s + r.billableCount, 0) / rows.length : 0;
      const weekAgo = rows.length >= 8 ? rows[rows.length - 8]!.billableCount : null;
      const weekDeltaPct = weekAgo && weekAgo > 0 ? ((latest - weekAgo) / weekAgo) * 100 : null;
      return {
        entityId: ent.id,
        entityName: ent.name,
        latestBillable: latest,
        avg7Day: Math.round(avg7),
        avg30Day: Math.round(avg30),
        weekDeltaPct: weekDeltaPct !== null ? Math.round(weekDeltaPct * 10) / 10 : null,
      };
    });

    const studentWhere = {
      institutionId,
      deletedAt: null,
      ...entityFilter,
    };
    const [students, activeStudents, staff, meetings, statusGroups] = await Promise.all([
      this.prisma.student.count({ where: studentWhere }),
      this.prisma.student.count({
        where: {
          ...studentWhere,
          enrollmentStatus: StudentEnrollmentStatusEnum.ACTIVE,
        },
      }),
      this.prisma.staffProfile.count({
        where: { institutionId, deletedAt: null, ...entityFilter },
      }),
      this.prisma.meeting.count({
        where: { institutionId, deletedAt: null, ...entityFilter },
      }),
      this.prisma.student.groupBy({
        by: ['enrollmentStatus'],
        where: studentWhere,
        _count: { _all: true },
      }),
    ]);

    const enrollmentMix: Record<string, number> = {};
    for (const g of statusGroups) {
      enrollmentMix[g.enrollmentStatus] = g._count._all;
    }

    return {
      period: {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
        label: 'Last 7 days',
      },
      scope: entityId ? 'entity' : 'institution-wide',
      entityId,
      entityName: entityId ? entities[0]?.name : undefined,
      totals: { students, activeStudents, staff, meetings },
      billing,
      enrollmentMix,
    };
  }

  /** Cross-entity (VC) or single-entity (Principal) weekly executive narrative. */
  async weeklyNarrative(institutionId: string, entityId?: string) {
    const context = await this.buildWeeklyContext(institutionId, entityId);
    const audience = entityId
      ? `entity Principal for ${context.entityName}`
      : 'Vice-Chancellor (cross-entity consolidated view)';

    const narrative = await this.ai.complete(institutionId, [
      {
        role: 'system',
        content:
          `Write a weekly administrative intelligence brief for ${audience}. ` +
          'Sections: Highlights, Billing & headcount trends, Enrollment health, Risks & follow-ups. ' +
          'Use only supplied metrics; do not invent figures. Keep under 400 words.',
      },
      { role: 'user', content: JSON.stringify(context) },
    ]);

    return {
      institutionId,
      entityId: entityId ?? null,
      period: context.period,
      metrics: context,
      narrative,
      isAIGenerated: true,
    };
  }
}
