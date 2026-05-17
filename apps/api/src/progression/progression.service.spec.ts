import { BadRequestException } from '@nestjs/common';
import { GpaRepeatPolicy } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { GpaComputationService } from './gpa-computation.service';
import { ProgressionService } from './progression.service';
import type { ResitGradeService } from './resit-grade.service';

describe('ProgressionService.evaluateBatch', () => {
  const prisma = {
    semester: { findFirst: jest.fn() },
    student: { findMany: jest.fn() },
    progressionRule: { findFirst: jest.fn() },
    progressionDecision: { findFirst: jest.fn(), create: jest.fn() },
    workflowInstance: { findFirst: jest.fn() },
  };
  const audit = { append: jest.fn() };
  const gpaComputation = new GpaComputationService();
  const resitGrades = { clampNumericScoreForEnrollment: jest.fn() } as unknown as ResitGradeService;
  const workflows = { initiateWorkflow: jest.fn() };

  let service: ProgressionService;

  const actor: AuthUser = {
    userId: 'u1',
    email: 'a@b.com',
    role: 'STAFF',
    institutionId: 'i1',
    entityId: 'e1',
    entityScope: 'ALL',
    permissions: ['progression.write'],
  };

  function enrollmentWithPoints(gradePts: number) {
    return {
      status: 'COMPLETED',
      deletedAt: null,
      semesterId: 'sem1',
      grade: { gradePoints: gradePts },
      semester: { startDate: new Date('2025-01-01') },
      section: { course: { id: 'c1', creditHours: 3 } },
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProgressionService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      gpaComputation,
      resitGrades,
      workflows as unknown as WorkflowEngineService,
    );
  });

  it('rejects an empty semester id', async () => {
    await expect(service.evaluateBatch(actor, { semesterId: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('dry run does not initiate workflows even when requested', async () => {
    prisma.semester.findFirst.mockResolvedValue({ id: 'sem1', name: 'Fall' });
    prisma.student.findMany.mockResolvedValue([]);
    const res = await service.evaluateBatch(actor, {
      semesterId: 'sem1',
      dryRun: true,
      initiateReviewWorkflows: true,
    });
    expect(res.workflowsStarted).toBe(0);
    expect(res.workflowFailures).toHaveLength(0);
    expect(workflows.initiateWorkflow).not.toHaveBeenCalled();
  });

  it('starts a review workflow for CONDITIONAL_REVIEW when not a dry run', async () => {
    prisma.semester.findFirst.mockResolvedValue({ id: 'sem1', name: 'Fall' });
    const rule = {
      minGpaPromotion: { toNumber: () => 3.0 },
      conditionalPromotionMinGpa: { toNumber: () => 2.5 },
      gpaRepeatPolicy: GpaRepeatPolicy.BEST_OF_ATTEMPTS,
      maxRepeatAttemptsPerLevel: 3,
      maxProgrammeDurationYears: null,
    };
    prisma.progressionRule.findFirst.mockResolvedValueOnce(rule);
    prisma.student.findMany.mockResolvedValue([
      {
        id: 's1',
        entityId: 'ent1',
        studentNumber: '001',
        programId: 'p1',
        admissionDate: null,
        program: { durationYears: 4 },
        enrollments: [enrollmentWithPoints(2.75)],
      },
    ]);
    prisma.workflowInstance.findFirst.mockResolvedValue(null);
    workflows.initiateWorkflow.mockResolvedValue({ id: 'wf1' });

    const res = await service.evaluateBatch(actor, {
      semesterId: 'sem1',
      dryRun: false,
      initiateReviewWorkflows: true,
    });

    expect(res.items[0].recommendation).toBe('CONDITIONAL_REVIEW');
    expect(res.workflowsStarted).toBe(1);
    expect(workflows.initiateWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        definitionCode: 'ACADEMIC_PROGRESSION_CONDITIONAL',
        entityType: 'ProgressionReview',
        entityId_record: 's1:sem1:ACADEMIC_PROGRESSION_CONDITIONAL',
        institutionId: 'i1',
        entityId: 'ent1',
        initiatedBy: 'u1',
      }),
    );
  });

  it('collects workflow initiation errors instead of failing the batch', async () => {
    prisma.semester.findFirst.mockResolvedValue({ id: 'sem1', name: 'Fall' });
    const rule = {
      minGpaPromotion: { toNumber: () => 3.0 },
      conditionalPromotionMinGpa: { toNumber: () => 2.5 },
      gpaRepeatPolicy: GpaRepeatPolicy.BEST_OF_ATTEMPTS,
      maxRepeatAttemptsPerLevel: 3,
      maxProgrammeDurationYears: null,
    };
    prisma.progressionRule.findFirst.mockResolvedValueOnce(rule);
    prisma.student.findMany.mockResolvedValue([
      {
        id: 's1',
        entityId: 'ent1',
        studentNumber: '001',
        programId: 'p1',
        admissionDate: null,
        program: { durationYears: 4 },
        enrollments: [enrollmentWithPoints(2.75)],
      },
    ]);
    prisma.workflowInstance.findFirst.mockResolvedValue(null);
    workflows.initiateWorkflow.mockRejectedValue(new Error('no assignee'));

    const res = await service.evaluateBatch(actor, {
      semesterId: 'sem1',
      dryRun: false,
      initiateReviewWorkflows: true,
    });

    expect(res.workflowsStarted).toBe(0);
    expect(res.workflowFailures).toHaveLength(1);
    expect(res.workflowFailures[0].message).toContain('no assignee');
  });

  it('skips starting a duplicate in-progress progression review workflow', async () => {
    prisma.semester.findFirst.mockResolvedValue({ id: 'sem1', name: 'Fall' });
    const rule = {
      minGpaPromotion: { toNumber: () => 3.0 },
      conditionalPromotionMinGpa: { toNumber: () => 2.5 },
      gpaRepeatPolicy: GpaRepeatPolicy.BEST_OF_ATTEMPTS,
      maxRepeatAttemptsPerLevel: 3,
      maxProgrammeDurationYears: null,
    };
    prisma.progressionRule.findFirst.mockResolvedValueOnce(rule);
    prisma.student.findMany.mockResolvedValue([
      {
        id: 's1',
        entityId: 'ent1',
        studentNumber: '001',
        programId: 'p1',
        admissionDate: null,
        program: { durationYears: 4 },
        enrollments: [enrollmentWithPoints(2.75)],
      },
    ]);
    prisma.workflowInstance.findFirst.mockResolvedValue({ id: 'existing' });

    const res = await service.evaluateBatch(actor, {
      semesterId: 'sem1',
      dryRun: false,
      initiateReviewWorkflows: true,
    });

    expect(res.workflowsStarted).toBe(0);
    expect(workflows.initiateWorkflow).not.toHaveBeenCalled();
  });
});
