import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * LAW P3 — single enforcement path when persisting numeric grades for resit-linked enrollments.
 * Invoked by {@link ../grades/grades.service GradesService} on entry and grade-override approval.
 */
@Injectable()
export class ResitGradeService {
  constructor(private readonly prisma: PrismaService) {}

  async clampNumericScoreForEnrollment(
    institutionId: string,
    enrollmentId: string,
    score: number,
  ): Promise<{ score: number; capApplied: boolean }> {
    const resit = await this.prisma.resitRecord.findFirst({
      where: { enrollmentId, institutionId },
      select: { id: true, gradeCapPercent: true },
    });
    if (!resit) {
      return { score, capApplied: false };
    }
    const cap = resit.gradeCapPercent.toNumber();
    const next = Math.min(score, cap);
    const capApplied = next < score;
    if (capApplied) {
      await this.prisma.resitRecord.update({
        where: { id: resit.id },
        data: { capApplied: true },
      });
    }
    return { score: next, capApplied };
  }
}
