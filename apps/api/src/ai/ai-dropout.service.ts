import { Injectable } from '@nestjs/common';
import { StudentEnrollmentStatusEnum } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from './ai.service';

@Injectable()
export class AiDropoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  /** Institution-wide dropout risk with per-entity breakdown. */
  async assessConsolidated(institutionId: string) {
    const entities = await this.prisma.institutionEntity.findMany({
      where: { institutionId, deletedAt: null },
      select: { id: true, name: true, code: true },
    });
    const byEntity = await Promise.all(
      entities.map(async (ent) => {
        const result = await this.assess(institutionId, ent.id, { skipNarrative: true });
        return {
          entityId: ent.id,
          entityName: ent.name,
          entityCode: ent.code,
          atRiskCount: result.atRiskCount,
          topRisk: result.atRisk.slice(0, 5),
        };
      }),
    );
    const totalAtRisk = byEntity.reduce((s, e) => s + e.atRiskCount, 0);
    let narrative: string | undefined;
    if (totalAtRisk > 0) {
      narrative = await this.ai.complete(institutionId, [
        {
          role: 'system',
          content:
            'Summarize institution-wide dropout/at-risk patterns for executive leadership. ' +
            'Reference entities by name from data only. Use Student A/B for individuals. ' +
            'Sections: Overview, Hotspot entities, Recommended interventions.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            scope: 'consolidated',
            totalAtRisk,
            byEntity: byEntity.map((e) => ({
              entity: e.entityName,
              atRiskCount: e.atRiskCount,
            })),
          }),
        },
      ]);
    }
    return {
      institutionId,
      entityId: null,
      atRiskCount: totalAtRisk,
      byEntity,
      narrative,
      isAIGenerated: Boolean(narrative),
    };
  }

  async assess(institutionId: string, entityId?: string, opts?: { skipNarrative?: boolean }) {
    const where = {
      institutionId,
      ...(entityId ? { entityId } : {}),
      deletedAt: null as Date | null,
    };
    const students = await this.prisma.student.findMany({
      where,
      select: {
        id: true,
        enrollmentStatus: true,
        currentLevel: true,
        enrollments: {
          take: 8,
          orderBy: { enrolledAt: 'desc' },
          select: { status: true, grade: true },
        },
        studentProgressionHolds: {
          where: { clearedAt: null },
          select: { type: true },
        },
      },
      take: 500,
    });

    const atRisk = students
      .map((s) => {
        let score = 0;
        if (s.enrollmentStatus !== StudentEnrollmentStatusEnum.ACTIVE) score += 2;
        if (s.studentProgressionHolds.length > 0) score += 2;
        const failed = s.enrollments.filter((e) => {
          const g = e.grade as { letter?: string; percent?: number } | null;
          if (!g) return false;
          if (typeof g.percent === 'number' && g.percent < 50) return true;
          return /F|FAIL/i.test(g.letter ?? '');
        }).length;
        if (failed >= 2) score += 3;
        if (failed === 1) score += 1;
        return {
          studentId: s.id,
          score,
          failedEnrollments: failed,
          holds: s.studentProgressionHolds.length,
        };
      })
      .filter((r) => r.score >= 3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 25);

    let narrative: string | undefined;
    if (!opts?.skipNarrative && atRisk.length > 0) {
      narrative = await this.ai.complete(institutionId, [
        {
          role: 'system',
          content:
            'Summarize dropout/at-risk patterns for leadership. Use anonymized labels (Student A, B). Do not invent grades.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            entityId: entityId ?? 'institution-wide',
            atRiskCount: atRisk.length,
            sample: atRisk.slice(0, 10),
          }),
        },
      ]);
    }

    return {
      institutionId,
      entityId,
      atRiskCount: atRisk.length,
      atRisk,
      narrative,
      isAIGenerated: Boolean(narrative),
    };
  }
}
