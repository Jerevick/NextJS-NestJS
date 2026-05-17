import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  Prisma,
  GpaRepeatPolicy,
  ProgressionRuleScope,
  ProgressionDecisionKind,
  ProgressionPromotionSubtype,
  WorkflowStatus,
  type ProgressionDecision,
  type ProgressionRule,
  type StudentProgressionHold,
  type StudentProgressionHoldType,
} from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import type { CreateProgressionDecisionDto } from './dto/create-progression-decision.dto';
import type { CreateProgressionRuleDto } from './dto/create-progression-rule.dto';
import type { CreateCarryoverEnrollmentDto } from './dto/create-carryover-enrollment.dto';
import type { RegisterResitDto } from './dto/register-resit.dto';
import type { UpsertAcademicSessionDto } from './dto/upsert-academic-session.dto';
import type { EvaluateProgressionBatchDto } from './dto/evaluate-progression-batch.dto';
import type { ListProgressionRulesQueryDto } from './dto/list-progression-rules-query.dto';
import type { UpdateProgressionRuleDto } from './dto/update-progression-rule.dto';
import { GpaComputationService } from './gpa-computation.service';
import {
  classifyBatchRecommendation,
  isAdmissionBeyondDurationCap,
  programmeDurationCapYears,
  type BatchRecommendation,
} from './progression-batch-eval';
import { workflowDefinitionForRecommendation } from './progression-review-workflow.util';
import { ResitGradeService } from './resit-grade.service';

function decToNumber(d: Decimal | null | undefined): number | null | undefined {
  if (d === null || d === undefined) {
    return d as null | undefined;
  }
  return d.toNumber();
}

@Injectable()
export class ProgressionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly gpaComputation: GpaComputationService,
    private readonly resitGrades: ResitGradeService,
    @Inject(forwardRef(() => WorkflowEngineService))
    private readonly workflows: WorkflowEngineService,
  ) {}

  private scopeEntityId(actor: AuthUser): string | undefined {
    return actor.entityScope === 'ALL' ? undefined : actor.entityId;
  }

  private async loadStudent(actor: AuthUser, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId: actor.institutionId, deletedAt: null },
      select: { id: true, entityId: true, programId: true, enrollmentStatus: true },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (actor.entityScope === 'ENTITY' && student.entityId !== actor.entityId) {
      throw new ForbiddenException('Student is outside your campus entity scope');
    }
    return student;
  }

  async listRules(actor: AuthUser, query: ListProgressionRulesQueryDto) {
    const where: Prisma.ProgressionRuleWhereInput = {
      institutionId: actor.institutionId,
      deletedAt: null,
    };
    if (query.ruleScope) {
      where.ruleScope = query.ruleScope;
    }
    if (query.programId?.trim()) {
      where.programId = query.programId.trim();
    }
    const rows = await this.prisma.progressionRule.findMany({
      where,
      orderBy: [{ ruleScope: 'asc' }, { programId: 'asc' }],
    });
    return { data: rows.map((r) => this.serializeRule(r)) };
  }

  async createRule(actor: AuthUser, dto: CreateProgressionRuleDto) {
    const programId = dto.programId?.trim() || null;
    if (dto.ruleScope === 'PROGRAM' && !programId) {
      throw new BadRequestException('programId is required for PROGRAM-scoped progression rules');
    }
    if (dto.ruleScope === 'INSTITUTION' && programId) {
      throw new BadRequestException(
        'programId must be omitted for INSTITUTION-scoped progression rules',
      );
    }
    if (programId) {
      const program = await this.prisma.program.findFirst({
        where: { id: programId, institutionId: actor.institutionId, deletedAt: null },
        select: { id: true },
      });
      if (!program) {
        throw new NotFoundException('Program not found');
      }
    }
    const existing =
      dto.ruleScope === 'INSTITUTION'
        ? await this.prisma.progressionRule.findFirst({
            where: {
              institutionId: actor.institutionId,
              ruleScope: ProgressionRuleScope.INSTITUTION,
              deletedAt: null,
            },
          })
        : await this.prisma.progressionRule.findFirst({
            where: {
              institutionId: actor.institutionId,
              ruleScope: ProgressionRuleScope.PROGRAM,
              programId: programId!,
              deletedAt: null,
            },
          });
    if (existing) {
      throw new ConflictException('An active progression rule already exists for this scope');
    }

    const row = await this.prisma.progressionRule.create({
      data: {
        institutionId: actor.institutionId,
        ruleScope: dto.ruleScope,
        programId,
        minGpaPromotion: dto.minGpaPromotion ?? null,
        conditionalPromotionMinGpa: dto.conditionalPromotionMinGpa ?? null,
        maxCarryoverCourses: dto.maxCarryoverCourses ?? 2,
        maxRepeatAttemptsPerLevel: dto.maxRepeatAttemptsPerLevel ?? 2,
        maxProgrammeDurationYears: dto.maxProgrammeDurationYears ?? null,
        maxResitAttempts: dto.maxResitAttempts ?? 1,
        resitGradeCapPercent: dto.resitGradeCapPercent ?? 40,
        gpaRepeatPolicy: dto.gpaRepeatPolicy ?? undefined,
      },
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'progression.rule.create',
      entity: 'ProgressionRule',
      entityId: row.id,
      newValues: { ruleScope: row.ruleScope, programId: row.programId } as Prisma.InputJsonValue,
    });
    return this.serializeRule(row);
  }

  async updateRule(
    actor: AuthUser,
    ruleId: string,
    dto: UpdateProgressionRuleDto,
  ): Promise<Record<string, unknown>> {
    const rule = await this.prisma.progressionRule.findFirst({
      where: { id: ruleId, institutionId: actor.institutionId, deletedAt: null },
    });
    if (!rule) {
      throw new NotFoundException('Progression rule not found');
    }
    const data: Prisma.ProgressionRuleUpdateInput = {};
    if (dto.minGpaPromotion !== undefined) data.minGpaPromotion = dto.minGpaPromotion;
    if (dto.conditionalPromotionMinGpa !== undefined) {
      data.conditionalPromotionMinGpa = dto.conditionalPromotionMinGpa;
    }
    if (dto.maxCarryoverCourses !== undefined) data.maxCarryoverCourses = dto.maxCarryoverCourses;
    if (dto.maxRepeatAttemptsPerLevel !== undefined) {
      data.maxRepeatAttemptsPerLevel = dto.maxRepeatAttemptsPerLevel;
    }
    if (dto.maxProgrammeDurationYears !== undefined) {
      data.maxProgrammeDurationYears = dto.maxProgrammeDurationYears;
    }
    if (dto.maxResitAttempts !== undefined) data.maxResitAttempts = dto.maxResitAttempts;
    if (dto.resitGradeCapPercent !== undefined) {
      data.resitGradeCapPercent = dto.resitGradeCapPercent;
    }
    if (dto.gpaRepeatPolicy !== undefined) data.gpaRepeatPolicy = dto.gpaRepeatPolicy;

    const row = await this.prisma.progressionRule.update({
      where: { id: ruleId },
      data,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'progression.rule.update',
      entity: 'ProgressionRule',
      entityId: row.id,
    });
    return this.serializeRule(row);
  }

  async removeRule(actor: AuthUser, ruleId: string): Promise<{ deleted: true }> {
    const rule = await this.prisma.progressionRule.findFirst({
      where: { id: ruleId, institutionId: actor.institutionId, deletedAt: null },
    });
    if (!rule) {
      throw new NotFoundException('Progression rule not found');
    }
    await this.prisma.progressionRule.update({
      where: { id: ruleId },
      data: { deletedAt: new Date() },
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'progression.rule.soft_delete',
      entity: 'ProgressionRule',
      entityId: ruleId,
    });
    return { deleted: true as const };
  }

  async listDecisions(actor: AuthUser, studentId: string, limit = 50) {
    await this.loadStudent(actor, studentId);
    const scope = this.scopeEntityId(actor);
    const rows = await this.prisma.progressionDecision.findMany({
      where: {
        institutionId: actor.institutionId,
        studentId,
        ...(scope ? { entityId: scope } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
    return { data: rows.map((r) => this.serializeDecision(r)) };
  }

  async createDecision(
    actor: AuthUser,
    dto: CreateProgressionDecisionDto,
  ): Promise<Record<string, unknown>> {
    const student = await this.loadStudent(actor, dto.studentId.trim());
    const programId = (dto.programId ?? student.programId).trim();
    const program = await this.prisma.program.findFirst({
      where: { id: programId, institutionId: actor.institutionId, deletedAt: null },
      select: { id: true },
    });
    if (!program) {
      throw new NotFoundException('Program not found for this student');
    }
    if (programId !== student.programId) {
      throw new BadRequestException('programId does not match the student’s current programme');
    }

    if (dto.semesterId?.trim()) {
      const sem = await this.prisma.semester.findFirst({
        where: { id: dto.semesterId.trim(), institutionId: actor.institutionId, deletedAt: null },
        select: { id: true },
      });
      if (!sem) {
        throw new NotFoundException('Semester not found');
      }
    }
    if (dto.academicYearId?.trim()) {
      const y = await this.prisma.academicYear.findFirst({
        where: {
          id: dto.academicYearId.trim(),
          institutionId: actor.institutionId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!y) {
        throw new NotFoundException('Academic year not found');
      }
    }
    if (dto.priorDecisionId?.trim()) {
      const prior = await this.prisma.progressionDecision.findFirst({
        where: {
          id: dto.priorDecisionId.trim(),
          institutionId: actor.institutionId,
          studentId: student.id,
        },
      });
      if (!prior) {
        throw new NotFoundException('Prior progression decision not found');
      }
    }

    const payload: Prisma.InputJsonValue = {
      ...((dto.payload ?? {}) as Record<string, unknown>),
      ...(dto.justification?.trim() ? { justification: dto.justification.trim() } : {}),
    };

    const row = await this.prisma.progressionDecision.create({
      data: {
        institutionId: actor.institutionId,
        entityId: student.entityId,
        studentId: student.id,
        programId,
        kind: dto.kind,
        promotionSubtype: dto.promotionSubtype ?? null,
        repeatSubtype: dto.repeatSubtype ?? null,
        semesterId: dto.semesterId?.trim() ?? null,
        academicYearId: dto.academicYearId?.trim() ?? null,
        priorDecisionId: dto.priorDecisionId?.trim() ?? null,
        payload,
        createdByUserId: actor.userId,
      },
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'progression.decision.create',
      entity: 'ProgressionDecision',
      entityId: row.id,
      newValues: { kind: row.kind, studentId: row.studentId } as Prisma.InputJsonValue,
    });
    return this.serializeDecision(row);
  }

  async evaluateBatch(
    actor: AuthUser,
    dto: EvaluateProgressionBatchDto,
  ): Promise<{
    dryRun: boolean;
    semesterId: string;
    semesterName: string | null;
    evaluated: number;
    wroteDecisions: number;
    workflowsStarted: number;
    workflowFailures: Array<{ studentId: string; definitionCode: string; message: string }>;
    items: Array<{
      studentId: string;
      studentNumber: string;
      programId: string;
      cumulativeGpa: number | null;
      recommendation: BatchRecommendation;
      minGpaPromotion: number | null;
      conditionalPromotionMinGpa: number | null;
    }>;
    note: string;
  }> {
    const semesterId = dto.semesterId?.trim();
    if (!semesterId) {
      throw new BadRequestException('semesterId is required for batch evaluation');
    }
    const sem = await this.prisma.semester.findFirst({
      where: { id: semesterId, institutionId: actor.institutionId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!sem) {
      throw new NotFoundException('Semester not found');
    }
    const dryRun = dto.dryRun !== false;
    const scope = this.scopeEntityId(actor);

    const candidates = await this.prisma.student.findMany({
      where: {
        institutionId: actor.institutionId,
        deletedAt: null,
        enrollmentStatus: 'ACTIVE',
        ...(scope ? { entityId: scope } : {}),
        enrollments: {
          some: {
            semesterId,
            deletedAt: null,
            status: { in: ['ENROLLED', 'COMPLETED'] },
          },
        },
      },
      select: {
        id: true,
        entityId: true,
        studentNumber: true,
        programId: true,
        admissionDate: true,
        program: { select: { durationYears: true } },
        enrollments: {
          where: { deletedAt: null },
          include: {
            section: { include: { course: { select: { id: true, creditHours: true } } } },
            semester: { select: { startDate: true } },
          },
        },
      },
    });

    const ruleCache = new Map<string, ProgressionRule | null>();
    const getRule = async (programId: string) => {
      const cached = ruleCache.get(programId);
      if (cached !== undefined) {
        return cached;
      }
      const r = await this.getEffectiveRuleRow(actor.institutionId, programId);
      ruleCache.set(programId, r);
      return r;
    };

    const items: Array<{
      studentId: string;
      studentNumber: string;
      programId: string;
      cumulativeGpa: number | null;
      recommendation: BatchRecommendation;
      minGpaPromotion: number | null;
      conditionalPromotionMinGpa: number | null;
    }> = [];

    let wroteDecisions = 0;
    let workflowsStarted = 0;
    const workflowFailures: Array<{ studentId: string; definitionCode: string; message: string }> =
      [];
    const initiateWfRequested = dto.initiateReviewWorkflows === true && !dryRun;

    for (const s of candidates) {
      const rule = await getRule(s.programId);
      const policy = rule?.gpaRepeatPolicy ?? GpaRepeatPolicy.BEST_OF_ATTEMPTS;
      const rows = this.gpaComputation.rowsFromEnrollments(s.enrollments);
      const summary = this.gpaComputation.summarizeWithPolicy(rows, policy);

      const durationExceeded =
        !!rule &&
        !!s.admissionDate &&
        isAdmissionBeyondDurationCap(
          s.admissionDate,
          programmeDurationCapYears(rule.maxProgrammeDurationYears, s.program.durationYears),
        );

      const minP = rule ? decToNumber(rule.minGpaPromotion) : undefined;
      const condP = rule ? decToNumber(rule.conditionalPromotionMinGpa) : undefined;

      const recommendation = classifyBatchRecommendation({
        cumulativeGpa: summary.cumulativeGpa,
        minGpaPromotion: minP,
        conditionalPromotionMinGpa: condP,
        durationExceeded,
        hasProgressionRule: !!rule,
      });

      items.push({
        studentId: s.id,
        studentNumber: s.studentNumber,
        programId: s.programId,
        cumulativeGpa: summary.cumulativeGpa,
        recommendation,
        minGpaPromotion: minP ?? null,
        conditionalPromotionMinGpa: condP ?? null,
      });

      if (!dryRun && recommendation === 'AUTOMATIC_PROMOTION') {
        const dup = await this.prisma.progressionDecision.findFirst({
          where: {
            studentId: s.id,
            institutionId: actor.institutionId,
            semesterId,
            kind: ProgressionDecisionKind.PROMOTION,
            promotionSubtype: ProgressionPromotionSubtype.AUTOMATIC,
          },
        });
        if (!dup) {
          await this.prisma.progressionDecision.create({
            data: {
              institutionId: actor.institutionId,
              entityId: s.entityId,
              studentId: s.id,
              programId: s.programId,
              kind: ProgressionDecisionKind.PROMOTION,
              promotionSubtype: ProgressionPromotionSubtype.AUTOMATIC,
              semesterId,
              payload: {
                cumulativeGpa: summary.cumulativeGpa,
                source: 'evaluate_batch',
                semesterId,
                semesterName: sem.name,
              } as Prisma.InputJsonValue,
              createdByUserId: actor.userId,
            },
          });
          wroteDecisions += 1;
        }
      }

      if (initiateWfRequested) {
        const defCode = workflowDefinitionForRecommendation(recommendation);
        if (defCode) {
          const entityRecord = `${s.id}:${semesterId}:${defCode}`;
          const wfDup = await this.prisma.workflowInstance.findFirst({
            where: {
              institutionId: actor.institutionId,
              definitionCode: defCode,
              entityType: 'ProgressionReview',
              entityId_record: entityRecord,
              status: WorkflowStatus.IN_PROGRESS,
            },
          });
          if (!wfDup) {
            try {
              await this.workflows.initiateWorkflow({
                institutionId: actor.institutionId,
                entityId: s.entityId,
                definitionCode: defCode,
                entityType: 'ProgressionReview',
                entityId_record: entityRecord,
                initiatedBy: actor.userId,
                metadata: {
                  studentId: s.id,
                  studentNumber: s.studentNumber,
                  semesterId,
                  semesterName: sem.name ?? null,
                  recommendation,
                  cumulativeGpa: summary.cumulativeGpa,
                },
              });
              workflowsStarted += 1;
            } catch (err: unknown) {
              workflowFailures.push({
                studentId: s.id,
                definitionCode: defCode,
                message: err instanceof Error ? err.message : String(err),
              });
            }
          }
        }
      }
    }

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'progression.evaluate_batch',
      entity: 'Semester',
      entityId: semesterId,
      newValues: {
        dryRun,
        evaluated: items.length,
        wroteDecisions,
        initiateReviewWorkflows: initiateWfRequested,
        workflowsStarted,
        workflowFailures: workflowFailures.length,
      } as Prisma.InputJsonValue,
    });

    const wfNote =
      !initiateWfRequested || dryRun
        ? ''
        : ` Started ${workflowsStarted} progression review workflow(s).${
            workflowFailures.length
              ? ` ${workflowFailures.length} workflow initiation(s) failed (see workflowFailures).`
              : ''
          }`;

    return {
      dryRun,
      semesterId,
      semesterName: sem.name,
      evaluated: items.length,
      wroteDecisions,
      workflowsStarted,
      workflowFailures,
      items,
      note: dryRun
        ? 'Dry run only — no progression decisions or workflows are written. Pass dryRun=false to persist automatic promotions and optionally initiate review workflows.'
        : `Wrote ${wroteDecisions} automatic promotion decision(s).${wfNote} Use POST /sis/progression/decisions when a manual decision is still required.`,
    };
  }

  async createHold(
    actor: AuthUser,
    studentId: string,
    dto: { type: StudentProgressionHoldType; reason?: string | null; semesterId?: string | null },
  ): Promise<Record<string, unknown>> {
    const student = await this.loadStudent(actor, studentId.trim());
    if (dto.semesterId?.trim()) {
      const sem = await this.prisma.semester.findFirst({
        where: { id: dto.semesterId.trim(), institutionId: actor.institutionId, deletedAt: null },
        select: { id: true },
      });
      if (!sem) {
        throw new NotFoundException('Semester not found');
      }
    }
    const row = await this.prisma.studentProgressionHold.create({
      data: {
        institutionId: actor.institutionId,
        entityId: student.entityId,
        studentId: student.id,
        type: dto.type,
        reason: dto.reason?.trim() ?? null,
        semesterId: dto.semesterId?.trim() ?? null,
        placedByUserId: actor.userId,
      },
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'progression.hold.create',
      entity: 'StudentProgressionHold',
      entityId: row.id,
      newValues: { studentId: row.studentId, type: row.type } as Prisma.InputJsonValue,
    });
    return this.serializeHold(row);
  }

  async clearHold(actor: AuthUser, holdId: string): Promise<Record<string, unknown>> {
    const scope = this.scopeEntityId(actor);
    const hold = await this.prisma.studentProgressionHold.findFirst({
      where: {
        id: holdId,
        institutionId: actor.institutionId,
        ...(scope ? { entityId: scope } : {}),
      },
    });
    if (!hold) {
      throw new NotFoundException('Progression hold not found');
    }
    if (hold.clearedAt) {
      throw new ConflictException('Hold already cleared');
    }
    const row = await this.prisma.studentProgressionHold.update({
      where: { id: holdId },
      data: { clearedAt: new Date() },
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'progression.hold.clear',
      entity: 'StudentProgressionHold',
      entityId: holdId,
    });
    return this.serializeHold(row);
  }

  async listActiveHolds(actor: AuthUser, studentId: string) {
    await this.loadStudent(actor, studentId);
    const scope = this.scopeEntityId(actor);
    const rows = await this.prisma.studentProgressionHold.findMany({
      where: {
        institutionId: actor.institutionId,
        studentId,
        clearedAt: null,
        ...(scope ? { entityId: scope } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data: rows.map((r) => this.serializeHold(r)) };
  }

  async getEffectiveRuleRow(
    institutionId: string,
    programId: string,
  ): Promise<ProgressionRule | null> {
    const programRule = await this.prisma.progressionRule.findFirst({
      where: {
        institutionId,
        ruleScope: ProgressionRuleScope.PROGRAM,
        programId,
        deletedAt: null,
      },
    });
    if (programRule) {
      return programRule;
    }
    return this.prisma.progressionRule.findFirst({
      where: { institutionId, ruleScope: ProgressionRuleScope.INSTITUTION, deletedAt: null },
    });
  }

  async resolveGpaRepeatPolicy(institutionId: string, programId: string): Promise<GpaRepeatPolicy> {
    const rule = await this.getEffectiveRuleRow(institutionId, programId);
    return rule?.gpaRepeatPolicy ?? GpaRepeatPolicy.BEST_OF_ATTEMPTS;
  }

  /**
   * Enforces repeat attempt count and maximum programme duration when an active rule exists for the institution/programme.
   */
  async assertEnrollmentWithinProgressionLimits(args: {
    institutionId: string;
    student: {
      id: string;
      programId: string;
      admissionDate: Date | null;
      program: { durationYears: number };
    };
    enrollmentAttemptNumber: number;
    originalSemesterId?: string | null;
  }): Promise<void> {
    const rule = await this.getEffectiveRuleRow(args.institutionId, args.student.programId);
    if (!rule) {
      return;
    }
    const attempt = args.enrollmentAttemptNumber;
    if (attempt > rule.maxRepeatAttemptsPerLevel) {
      throw new BadRequestException(
        `Enrollment attempt ${attempt} exceeds max attempts per study level (${rule.maxRepeatAttemptsPerLevel}) configured for this programme.`,
      );
    }
    const orig = args.originalSemesterId?.trim();
    if (orig) {
      const sem = await this.prisma.semester.findFirst({
        where: { id: orig, institutionId: args.institutionId, deletedAt: null },
        select: { id: true },
      });
      if (!sem) {
        throw new NotFoundException('originalSemesterId: semester not found');
      }
    }
    const capYears = programmeDurationCapYears(
      rule.maxProgrammeDurationYears,
      args.student.program.durationYears,
    );
    const anchor = args.student.admissionDate;
    if (anchor && isAdmissionBeyondDurationCap(anchor, capYears)) {
      throw new BadRequestException(
        `Maximum programme duration (${capYears} years) reached. Academic review is required before further enrollments.`,
      );
    }
  }

  /**
   * Resit numeric score cap (Law P3) — call before persisting a numeric score.
   */
  async clampNumericScoreForEnrollment(
    institutionId: string,
    enrollmentId: string,
    score: number,
  ): Promise<{ score: number; capApplied: boolean }> {
    return this.resitGrades.clampNumericScoreForEnrollment(institutionId, enrollmentId, score);
  }

  async createCarryoverLink(actor: AuthUser, dto: CreateCarryoverEnrollmentDto) {
    const originalId = dto.originalEnrollmentId.trim();
    const repeatId = dto.repeatEnrollmentId.trim();
    const original = await this.prisma.studentEnrollment.findFirst({
      where: {
        id: originalId,
        institutionId: actor.institutionId,
        deletedAt: null,
        studentId: dto.studentId.trim(),
      },
      include: { semester: { select: { name: true } } },
    });
    const repeat = await this.prisma.studentEnrollment.findFirst({
      where: {
        id: repeatId,
        institutionId: actor.institutionId,
        deletedAt: null,
        studentId: dto.studentId.trim(),
      },
    });
    if (!original || !repeat) {
      throw new NotFoundException('One or both enrollments were not found for this student');
    }
    if (actor.entityScope === 'ENTITY') {
      const st = await this.prisma.student.findFirst({
        where: { id: dto.studentId.trim(), institutionId: actor.institutionId },
        select: { entityId: true },
      });
      if (!st || st.entityId !== actor.entityId) {
        throw new ForbiddenException('Student is outside your campus entity scope');
      }
    }
    const dup = await this.prisma.carryoverEnrollment.findFirst({
      where: { OR: [{ originalEnrollmentId: originalId }, { repeatEnrollmentId: repeatId }] },
    });
    if (dup) {
      throw new ConflictException('Carryover link already exists for one of these enrollments');
    }
    const row = await this.prisma.carryoverEnrollment.create({
      data: {
        institutionId: actor.institutionId,
        originalEnrollmentId: originalId,
        repeatEnrollmentId: repeatId,
      },
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'progression.carryover.create',
      entity: 'CarryoverEnrollment',
      entityId: row.id,
      newValues: {
        studentId: dto.studentId,
        originalEnrollmentId: originalId,
        repeatEnrollmentId: repeatId,
        originalSemesterLabel: original.semester?.name ?? '',
      } as Prisma.InputJsonValue,
    });
    return {
      id: row.id,
      originalEnrollmentId: row.originalEnrollmentId,
      repeatEnrollmentId: row.repeatEnrollmentId,
    };
  }

  async registerResit(actor: AuthUser, dto: RegisterResitDto) {
    const enrollmentId = dto.enrollmentId.trim();
    const row = await this.prisma.studentEnrollment.findFirst({
      where: {
        id: enrollmentId,
        institutionId: actor.institutionId,
        deletedAt: null,
      },
      include: {
        student: { select: { id: true, entityId: true, programId: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Enrollment not found');
    }
    if (actor.entityScope === 'ENTITY' && row.student.entityId !== actor.entityId) {
      throw new ForbiddenException('Enrollment is outside your campus entity scope');
    }
    const existing = await this.prisma.resitRecord.findFirst({ where: { enrollmentId } });
    if (existing) {
      throw new ConflictException('A resit record already exists for this enrollment');
    }
    const rule = await this.getEffectiveRuleRow(actor.institutionId, row.student.programId);
    const capFromRule = rule ? decToNumber(rule.resitGradeCapPercent) : undefined;
    const pct = dto.gradeCapPercent !== undefined ? dto.gradeCapPercent : (capFromRule ?? 40);
    const created = await this.prisma.resitRecord.create({
      data: {
        institutionId: actor.institutionId,
        enrollmentId,
        gradeCapPercent: new Prisma.Decimal(pct),
      },
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'progression.resit.register',
      entity: 'ResitRecord',
      entityId: created.id,
      newValues: { enrollmentId, gradeCapPercent: pct } as Prisma.InputJsonValue,
    });
    return { id: created.id, enrollmentId, gradeCapPercent: pct, capApplied: created.capApplied };
  }

  async upsertAcademicSession(actor: AuthUser, dto: UpsertAcademicSessionDto) {
    const student = await this.loadStudent(actor, dto.studentId.trim());
    const ay = await this.prisma.academicYear.findFirst({
      where: { id: dto.academicYearId.trim(), institutionId: actor.institutionId, deletedAt: null },
      select: { id: true },
    });
    if (!ay) {
      throw new NotFoundException('Academic year not found');
    }
    if (dto.programId.trim() !== student.programId) {
      throw new BadRequestException('programId does not match the student programme');
    }
    const attemptNumber = dto.attemptNumber ?? 1;
    const repeatReason = dto.repeatReason ?? 'NONE';
    const row = await this.prisma.studentAcademicSessionRecord.upsert({
      where: {
        studentId_programId_academicYearId_studyLevel_attemptNumber: {
          studentId: student.id,
          programId: dto.programId.trim(),
          academicYearId: dto.academicYearId.trim(),
          studyLevel: dto.studyLevel,
          attemptNumber,
        },
      },
      create: {
        institutionId: actor.institutionId,
        entityId: student.entityId,
        studentId: student.id,
        programId: dto.programId.trim(),
        academicYearId: dto.academicYearId.trim(),
        studyLevel: dto.studyLevel,
        attemptNumber,
        repeatReason,
      },
      update: { repeatReason },
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'progression.session.upsert',
      entity: 'StudentAcademicSessionRecord',
      entityId: row.id,
      newValues: {
        studyLevel: row.studyLevel,
        attemptNumber: row.attemptNumber,
      } as Prisma.InputJsonValue,
    });
    return {
      id: row.id,
      studentId: row.studentId,
      programId: row.programId,
      academicYearId: row.academicYearId,
      studyLevel: row.studyLevel,
      attemptNumber: row.attemptNumber,
      repeatReason: row.repeatReason,
    };
  }

  async listCarryoversForStudent(actor: AuthUser, studentId: string) {
    await this.loadStudent(actor, studentId);
    const rows = await this.prisma.carryoverEnrollment.findMany({
      where: {
        institutionId: actor.institutionId,
        OR: [{ originalEnrollment: { studentId } }, { repeatEnrollment: { studentId } }],
      },
      select: {
        id: true,
        originalEnrollment: {
          select: {
            id: true,
            studentId: true,
            semester: { select: { name: true, id: true } },
            section: { select: { course: { select: { code: true } } } },
          },
        },
        repeatEnrollment: {
          select: {
            id: true,
            studentId: true,
            semester: { select: { name: true, id: true } },
            section: { select: { course: { select: { code: true } } } },
          },
        },
      },
    });
    const filtered = rows.filter(
      (r) =>
        r.originalEnrollment.studentId === studentId && r.repeatEnrollment.studentId === studentId,
    );
    return {
      data: filtered.map((r) => ({
        id: r.id,
        original: {
          enrollmentId: r.originalEnrollment.id,
          courseCode: r.originalEnrollment.section.course.code,
          semesterName: r.originalEnrollment.semester?.name ?? null,
        },
        repeat: {
          enrollmentId: r.repeatEnrollment.id,
          courseCode: r.repeatEnrollment.section.course.code,
          semesterName: r.repeatEnrollment.semester?.name ?? null,
        },
      })),
    };
  }

  async getStudentGpaBreakdown(actor: AuthUser, studentId: string) {
    await this.loadStudent(actor, studentId);
    const st = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId: actor.institutionId, deletedAt: null },
      select: {
        id: true,
        programId: true,
        enrollments: {
          where: { deletedAt: null },
          include: {
            section: {
              include: {
                course: { select: { id: true, code: true, creditHours: true } },
              },
            },
            semester: { select: { startDate: true } },
          },
        },
      },
    });
    if (!st) {
      throw new NotFoundException('Student not found');
    }
    const policy = await this.resolveGpaRepeatPolicy(actor.institutionId, st.programId);
    const rows = this.gpaComputation.rowsFromEnrollments(st.enrollments);
    const summary = this.gpaComputation.summarizeWithPolicy(rows, policy);
    return {
      studentId,
      policy,
      cumulativeGpa: summary.cumulativeGpa,
      contributions: summary.contributions.map((c) => ({
        courseId: c.courseId,
        gradePoints: Math.round(c.gradePoints * 100) / 100,
        creditHours: c.creditHours,
      })),
      creditHoursGradedUsed: summary.creditHoursGraded,
    };
  }

  private serializeRule(r: ProgressionRule) {
    return {
      id: r.id,
      institutionId: r.institutionId,
      ruleScope: r.ruleScope,
      programId: r.programId,
      minGpaPromotion: decToNumber(r.minGpaPromotion),
      conditionalPromotionMinGpa: decToNumber(r.conditionalPromotionMinGpa),
      maxCarryoverCourses: r.maxCarryoverCourses,
      maxRepeatAttemptsPerLevel: r.maxRepeatAttemptsPerLevel,
      maxProgrammeDurationYears: r.maxProgrammeDurationYears,
      maxResitAttempts: r.maxResitAttempts,
      resitGradeCapPercent: decToNumber(r.resitGradeCapPercent),
      gpaRepeatPolicy: r.gpaRepeatPolicy,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      deletedAt: r.deletedAt?.toISOString() ?? null,
    };
  }

  private serializeDecision(r: ProgressionDecision) {
    return {
      id: r.id,
      institutionId: r.institutionId,
      entityId: r.entityId,
      studentId: r.studentId,
      programId: r.programId,
      kind: r.kind,
      promotionSubtype: r.promotionSubtype,
      repeatSubtype: r.repeatSubtype,
      semesterId: r.semesterId,
      academicYearId: r.academicYearId,
      priorDecisionId: r.priorDecisionId,
      payload: r.payload,
      createdByUserId: r.createdByUserId,
      createdAt: r.createdAt.toISOString(),
    };
  }

  private serializeHold(r: StudentProgressionHold) {
    return {
      id: r.id,
      institutionId: r.institutionId,
      entityId: r.entityId,
      studentId: r.studentId,
      type: r.type,
      reason: r.reason,
      semesterId: r.semesterId,
      clearedAt: r.clearedAt?.toISOString() ?? null,
      placedByUserId: r.placedByUserId,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
