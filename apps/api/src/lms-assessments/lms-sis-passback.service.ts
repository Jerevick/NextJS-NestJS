import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import {
  parseGradeComponentWeights,
  weightedScoreFromComponents,
} from '../grades/grade-component-weights.util';
import { GradesRepository } from '../grades/grades.repository';
import { PrismaService } from '../prisma/prisma.service';
import { ResitGradeService } from '../progression/resit-grade.service';
import {
  applyLetterMappingFromNumeric,
  deriveEnrollmentPercentScoreFromSubmissionGrade,
  mergePrevComponentScores,
  readLmsAssessmentSisPassback,
} from './lms-sis-passback.util';

function asGradeObject(g: unknown): Record<string, unknown> {
  if (g && typeof g === 'object' && !Array.isArray(g)) {
    return { ...(g as Record<string, unknown>) };
  }
  return {};
}

/** Optional LMS assessment → **`StudentEnrollment.grade`** sync when graded in the LMS. */
@Injectable()
export class LmsSisPassbackService {
  private readonly log = new Logger(LmsSisPassbackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gradesRepo: GradesRepository,
    private readonly resit: ResitGradeService,
    private readonly audit: AuditService,
  ) {}

  async tryPassbackEnrollmentGradeFromGradedSubmission(
    actor: AuthUser,
    opts: {
      submissionId: string;
      studentId: string;
      courseInstanceId: string;
      assessmentId: string;
      assessmentSettings: unknown;
      assessmentTotalPoints: number;
      grade: unknown;
    },
  ): Promise<void> {
    try {
      const pb = readLmsAssessmentSisPassback(opts.assessmentSettings);
      if (!pb.enabled) {
        return;
      }

      const pct = deriveEnrollmentPercentScoreFromSubmissionGrade(
        opts.grade,
        opts.assessmentTotalPoints,
      );
      if (pct === null) {
        this.audit.append({
          institutionId: actor.institutionId,
          actorId: actor.userId,
          action: 'lms.sis_passback.skip_no_score',
          entity: 'LmsSubmission',
          entityId: opts.submissionId,
          newValues: { assessmentId: opts.assessmentId } as Prisma.InputJsonValue,
        });
        return;
      }

      const ci = await this.prisma.lmsCourseInstance.findFirst({
        where: {
          id: opts.courseInstanceId,
          institutionId: actor.institutionId,
          deletedAt: null,
        },
        select: { sectionId: true },
      });
      if (!ci) {
        return;
      }

      const enrollment = await this.prisma.studentEnrollment.findFirst({
        where: {
          institutionId: actor.institutionId,
          studentId: opts.studentId,
          sectionId: ci.sectionId,
          deletedAt: null,
        },
        select: { id: true, grade: true },
      });

      if (!enrollment) {
        this.audit.append({
          institutionId: actor.institutionId,
          actorId: actor.userId,
          action: 'lms.sis_passback.skip_no_enrollment',
          entity: 'LmsSubmission',
          entityId: opts.submissionId,
          newValues: {
            sectionId: ci.sectionId,
            studentId: opts.studentId,
          } as Prisma.InputJsonValue,
        });
        return;
      }

      const prev = asGradeObject(enrollment.grade);
      const wf = (prev.workflowStatus as string | undefined) ?? 'DRAFT';
      if (wf === 'APPROVED') {
        this.audit.append({
          institutionId: actor.institutionId,
          actorId: actor.userId,
          action: 'lms.sis_passback.skip_finalized',
          entity: 'StudentEnrollment',
          entityId: enrollment.id,
          newValues: { submissionId: opts.submissionId } as Prisma.InputJsonValue,
        });
        return;
      }

      const instSettings = await this.gradesRepo.getInstitutionSettings(actor.institutionId);
      const bands = parseGradeComponentWeights(instSettings?.settings);
      const scale =
        (await this.gradesRepo.findDefaultGradingScale(actor.institutionId)) ??
        (await this.gradesRepo.findFirstGradingScale(actor.institutionId));

      const clamped = await this.resit.clampNumericScoreForEnrollment(
        actor.institutionId,
        enrollment.id,
        pct,
      );

      const sourceMeta = {
        assessmentId: opts.assessmentId,
        submissionId: opts.submissionId,
        recordedAt: new Date().toISOString(),
      };

      let nextGrade: Record<string, unknown>;

      if (bands.length === 0) {
        nextGrade = {
          ...prev,
          score: clamped.score,
          lastUpdatedBy: actor.userId,
          updatedAt: new Date().toISOString(),
          lmsPassbackSource: sourceMeta,
        };
      } else {
        const comps = mergePrevComponentScores(prev);
        const bandKeys = new Set(bands.map((b) => b.key));
        if (!bandKeys.has(pb.componentKey)) {
          this.audit.append({
            institutionId: actor.institutionId,
            actorId: actor.userId,
            action: 'lms.sis_passback.skip_unknown_component_key',
            entity: 'StudentEnrollment',
            entityId: enrollment.id,
            newValues: { componentKey: pb.componentKey } as Prisma.InputJsonValue,
          });
          return;
        }

        comps[pb.componentKey] = clamped.score;
        const allFilled = bands.every(
          (b) => typeof comps[b.key] === 'number' && Number.isFinite(comps[b.key]),
        );

        nextGrade = {
          ...prev,
          components: comps,
          lastUpdatedBy: actor.userId,
          updatedAt: new Date().toISOString(),
          lmsPassbackSource: sourceMeta,
        };

        if (allFilled) {
          const w = weightedScoreFromComponents(bands, comps);
          const overall = await this.resit.clampNumericScoreForEnrollment(
            actor.institutionId,
            enrollment.id,
            w,
          );
          nextGrade.score = overall.score;
        }
      }

      if (typeof nextGrade.score === 'number' && Number.isFinite(nextGrade.score)) {
        nextGrade = applyLetterMappingFromNumeric(
          nextGrade,
          nextGrade.score,
          scale?.scale,
        ) as Record<string, unknown>;
      }

      await this.gradesRepo.updateEnrollmentGrade(
        enrollment.id,
        nextGrade as Prisma.InputJsonValue,
      );

      this.audit.append({
        institutionId: actor.institutionId,
        actorId: actor.userId,
        action: 'lms.sis_passback.applied',
        entity: 'StudentEnrollment',
        entityId: enrollment.id,
        newValues: {
          submissionId: opts.submissionId,
          assessmentId: opts.assessmentId,
          score: nextGrade.score ?? null,
        } as Prisma.InputJsonValue,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      this.log.warn(`LMS SIS passback failed (submission=${opts.submissionId}): ${message}`);
      this.audit.append({
        institutionId: actor.institutionId,
        actorId: actor.userId,
        action: 'lms.sis_passback.error',
        entity: 'LmsSubmission',
        entityId: opts.submissionId,
        newValues: { message } as Prisma.InputJsonValue,
      });
    }
  }
}
