import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { scrubTextForExternalAi } from './ai-pii.util';
import { AiService } from './ai.service';

export type AdvisorGap = { description: string; severity?: string };
export type AdvisorRecommendation = {
  courseCode?: string;
  title?: string;
  rationale: string;
};
export type AdvisorRiskFlag = { flag: string; detail: string };

export type AcademicAdvisorResult = {
  studentId: string;
  atRisk: boolean;
  gaps: AdvisorGap[];
  recommendations: AdvisorRecommendation[];
  riskFlags: AdvisorRiskFlag[];
  narrative: string;
  isAIGenerated: true;
};

@Injectable()
export class AiAdvisorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async advise(user: AuthUser, studentId: string): Promise<AcademicAdvisorResult> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId: user.institutionId, deletedAt: null },
      include: {
        entity: { select: { code: true, name: true } },
        program: {
          select: {
            code: true,
            name: true,
            creditHours: true,
            durationYears: true,
            progressionRules: {
              where: { deletedAt: null },
              take: 10,
            },
          },
        },
        user: { select: { profile: true } },
        enrollments: {
          where: { deletedAt: null },
          orderBy: { enrolledAt: 'desc' },
          take: 48,
          include: {
            section: {
              include: {
                course: { select: { code: true, title: true, creditHours: true } },
                entity: { select: { code: true, name: true } },
              },
            },
            semester: { select: { name: true } },
          },
        },
        studentProgressionHolds: {
          where: { clearedAt: null },
          select: { type: true, reason: true },
        },
        academicSessionRecords: {
          orderBy: { createdAt: 'desc' },
          take: 12,
          include: {
            entity: { select: { code: true, name: true } },
            academicYear: { select: { name: true } },
          },
        },
        progressionDecisions: {
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: { entity: { select: { code: true } } },
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');

    const profile = (student.user?.profile ?? {}) as {
      careerGoals?: string;
      goals?: string;
    };
    const careerGoals =
      student.careerGoals?.trim() ||
      profile.careerGoals?.trim() ||
      profile.goals?.trim() ||
      'Not specified';

    const payload = {
      homeEntity: student.entity,
      programme: {
        code: student.program.code,
        name: student.program.name,
        requiredCreditHours: student.program.creditHours,
        durationYears: student.program.durationYears,
        progressionRules: student.program.progressionRules,
      },
      student: {
        level: student.currentLevel,
        enrollmentStatus: student.enrollmentStatus,
        admissionDate: student.admissionDate,
        expectedGraduation: student.expectedGraduationDate,
        careerGoals,
      },
      activeHolds: student.studentProgressionHolds,
      academicHistoryAllEntities: student.enrollments.map((e) => ({
        entity: e.section.entity?.code ?? e.section.entity?.name,
        courseCode: e.section.course?.code,
        courseTitle: e.section.course?.title,
        credits: e.section.course?.creditHours,
        status: e.status,
        grade: e.grade,
        term: e.semester?.name,
      })),
      sessionRecords: student.academicSessionRecords.map((r) => ({
        entity: r.entity.code,
        academicYear: r.academicYear.name,
        studyLevel: r.studyLevel,
        attempt: r.attemptNumber,
      })),
      progressionDecisions: student.progressionDecisions.map((d) => ({
        entity: d.entity.code,
        kind: d.kind,
        semesterId: d.semesterId,
      })),
    };

    const scrubbed = scrubTextForExternalAi(JSON.stringify(payload));
    const raw = await this.ai.complete(user.institutionId, [
      {
        role: 'system',
        content:
          'You are an academic advisor for university staff. Return ONLY valid JSON with keys: ' +
          'gaps[{description,severity}], recommendations[{courseCode,title,rationale}], ' +
          'riskFlags[{flag,detail}], narrative (markdown summary for staff). ' +
          'Base analysis on graduation requirements, career goals, and cross-entity enrolment history. ' +
          'Do not invent courses or grades.',
      },
      { role: 'user', content: scrubbed },
    ]);

    const parsed = parseAdvisorResponse(raw);
    const atRisk =
      parsed.riskFlags.length > 0 ||
      student.studentProgressionHolds.length > 0 ||
      student.enrollments.some((e) => gradeIsFailing(e.grade));

    return {
      studentId,
      atRisk,
      gaps: parsed.gaps,
      recommendations: parsed.recommendations,
      riskFlags: parsed.riskFlags,
      narrative: parsed.narrative,
      isAIGenerated: true,
    };
  }

  assertInstitutionAccess(user: AuthUser, institutionId: string) {
    if (user.institutionId !== institutionId && !user.permissions?.includes('*')) {
      throw new ForbiddenException();
    }
  }
}

function gradeIsFailing(grade: unknown): boolean {
  const g = grade as { percent?: number; letter?: string } | null;
  if (!g) return false;
  if (g.percent != null && g.percent < 50) return true;
  return /F|FAIL/i.test(g.letter ?? '');
}

export function parseAdvisorResponse(raw: string): {
  gaps: AdvisorGap[];
  recommendations: AdvisorRecommendation[];
  riskFlags: AdvisorRiskFlag[];
  narrative: string;
} {
  const text = raw.trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      const j = JSON.parse(text.slice(start, end + 1)) as {
        gaps?: AdvisorGap[];
        recommendations?: AdvisorRecommendation[];
        riskFlags?: AdvisorRiskFlag[];
        narrative?: string;
      };
      return {
        gaps: Array.isArray(j.gaps) ? j.gaps : [],
        recommendations: Array.isArray(j.recommendations) ? j.recommendations : [],
        riskFlags: Array.isArray(j.riskFlags) ? j.riskFlags : [],
        narrative: j.narrative ?? text,
      };
    } catch {
      /* fall through */
    }
  }
  return {
    gaps: [],
    recommendations: [],
    riskFlags: [],
    narrative: text,
  };
}
