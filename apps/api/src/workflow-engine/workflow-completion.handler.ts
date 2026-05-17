import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import {
  BackfillRequestStatus,
  GraduationClearanceStatus,
  Prisma,
  ReactivationRequestStatus,
  StudentEnrollmentStatusEnum,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BillingInvoiceService } from '../billing/billing-invoice.service';
import { BillingJobsService } from '../billing/jobs/billing-jobs.service';
import { StudentDeletionService } from '../students/deletion/student-deletion.service';
import { StatusChangeService } from '../students/status/status-change.service';
import { GradesRepository } from '../grades/grades.repository';
import { ResitGradeService } from '../progression/resit-grade.service';
import { FinanceService } from '../finance/finance.service';
import { StaffService } from '../staff/staff.service';

@Injectable()
export class WorkflowCompletionHandler {
  private readonly log = new Logger(WorkflowCompletionHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly statusChanges: StatusChangeService,
    private readonly billingInvoices: BillingInvoiceService,
    private readonly billingJobs: BillingJobsService,
    private readonly studentDeletion: StudentDeletionService,
    private readonly gradesRepo: GradesRepository,
    private readonly resitGrades: ResitGradeService,
    @Inject(forwardRef(() => FinanceService))
    private readonly finance: FinanceService,
    @Inject(forwardRef(() => StaffService))
    private readonly staff: StaffService,
  ) {}

  async handleCompleted(
    definitionCode: string,
    institutionId: string,
    entityId_record: string,
    actorUserId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    switch (definitionCode) {
      case 'STUDENT_REACTIVATION':
        await this.completeReactivation(institutionId, entityId_record, actorUserId, metadata);
        break;
      case 'BACKFILL_REQUEST':
        await this.completeBackfill(institutionId, entityId_record, actorUserId);
        break;
      case 'STUDENT_PERMANENT_DELETION':
        await this.completePermanentDeletion(institutionId, entityId_record, actorUserId, metadata);
        break;
      case 'GRADUATION_CLEARANCE':
        await this.completeGraduationClearance(
          institutionId,
          entityId_record,
          actorUserId,
          metadata,
        );
        break;
      case 'GRADE_OVERRIDE':
        await this.completeGradeOverride(institutionId, entityId_record, actorUserId);
        break;
      case 'GRADE_RELEASE':
        await this.completeGradeReleaseReview(institutionId, entityId_record, actorUserId);
        break;
      case 'SCHOLARSHIP_APPLICATION':
        await this.finance.approveScholarshipApplicationFromWorkflow(
          institutionId,
          entityId_record,
          actorUserId,
        );
        break;
      case 'SCHOLARSHIP_AWARD':
        await this.finance.disburseScholarshipAwardFromWorkflow(
          institutionId,
          entityId_record,
          actorUserId,
        );
        break;
      case 'FEE_WAIVER':
      case 'FINANCE_REFUND':
      case 'STUDENT_EXCESS_REFUND':
        await this.finance.completeFinanceApprovalFromWorkflow(
          institutionId,
          entityId_record,
          actorUserId,
          metadata,
        );
        break;
      case 'STUDENT_EXCESS_TRANSFER':
        await this.finance.completeExcessTransferFromWorkflow(
          institutionId,
          entityId_record,
          actorUserId,
        );
        break;
      case 'LEAVE_REQUEST':
        await this.staff.completeLeaveFromWorkflow(institutionId, entityId_record);
        break;
      case 'STAFF_APPRAISAL':
        await this.staff.completeAppraisalFromWorkflow(institutionId, entityId_record);
        break;
      default:
        this.log.debug(`No completion handler for workflow ${definitionCode}`);
    }
  }

  async handleRejected(
    definitionCode: string,
    institutionId: string,
    entityId_record: string,
    actorUserId: string,
    notes?: string,
  ): Promise<void> {
    switch (definitionCode) {
      case 'STUDENT_REACTIVATION':
        await this.prisma.reactivationRequest.updateMany({
          where: { id: entityId_record, institutionId },
          data: {
            status: ReactivationRequestStatus.REJECTED,
            reviewedBy: actorUserId,
            reviewedAt: new Date(),
            reviewNotes: notes ?? null,
          },
        });
        break;
      case 'BACKFILL_REQUEST':
        await this.prisma.backfillRequest.updateMany({
          where: { id: entityId_record, institutionId },
          data: { status: BackfillRequestStatus.REJECTED },
        });
        break;
      case 'GRADUATION_CLEARANCE':
        await this.prisma.graduationClearanceRequest.updateMany({
          where: { id: entityId_record, institutionId },
          data: {
            status: GraduationClearanceStatus.REJECTED,
            reviewedBy: actorUserId,
            reviewedAt: new Date(),
            reviewNotes: notes ?? null,
          },
        });
        break;
      case 'GRADE_OVERRIDE':
        await this.prisma.gradeOverride.updateMany({
          where: { id: entityId_record, institutionId, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        break;
      case 'GRADE_RELEASE':
        await this.downgradeEnrollmentGradeSubmission(institutionId, entityId_record);
        break;
      case 'FEE_WAIVER':
      case 'FINANCE_REFUND':
      case 'STUDENT_EXCESS_REFUND':
      case 'STUDENT_EXCESS_TRANSFER':
        await this.finance.rejectFinanceApprovalFromWorkflow(
          institutionId,
          entityId_record,
          actorUserId,
        );
        break;
      case 'SCHOLARSHIP_APPLICATION':
        await this.finance.rejectScholarshipApplicationFromWorkflow(
          institutionId,
          entityId_record,
          actorUserId,
        );
        break;
      case 'LEAVE_REQUEST':
        await this.staff.rejectLeaveFromWorkflow(institutionId, entityId_record);
        break;
      case 'STAFF_APPRAISAL':
        await this.staff.rejectAppraisalFromWorkflow(institutionId, entityId_record);
        break;
      default:
        break;
    }
  }

  private async completeGraduationClearance(
    institutionId: string,
    clearanceRequestId: string,
    actorUserId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const request = await this.prisma.graduationClearanceRequest.findFirst({
      where: { id: clearanceRequestId, institutionId },
    });
    if (!request || request.status === GraduationClearanceStatus.CLEARED) {
      return;
    }

    const checks = Array.isArray(request.departmentChecks)
      ? (request.departmentChecks as Array<Record<string, unknown>>)
      : [];
    const clearedChecks = checks.map((c) => ({
      ...c,
      status: 'CLEARED',
      clearedAt: new Date().toISOString(),
      clearedBy: actorUserId,
    }));

    const reviewNotes = typeof metadata.reviewNotes === 'string' ? metadata.reviewNotes : undefined;

    await this.prisma.graduationClearanceRequest.update({
      where: { id: request.id },
      data: {
        status: GraduationClearanceStatus.CLEARED,
        departmentChecks: clearedChecks,
        clearedAt: new Date(),
        reviewedBy: actorUserId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes ?? null,
      },
    });

    this.audit.append({
      institutionId,
      actorId: actorUserId,
      action: 'workflow.completed:GRADUATION_CLEARANCE',
      entity: 'GraduationClearanceRequest',
      entityId: request.id,
      newValues: { studentId: request.studentId, status: GraduationClearanceStatus.CLEARED },
    });
  }

  private async completeReactivation(
    institutionId: string,
    reactivationRequestId: string,
    actorUserId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const request = await this.prisma.reactivationRequest.findFirst({
      where: { id: reactivationRequestId, institutionId },
      include: { student: { select: { id: true, studentNumber: true } } },
    });
    if (!request || request.status === ReactivationRequestStatus.APPROVED) {
      return;
    }

    const reviewNotes = typeof metadata.reviewNotes === 'string' ? metadata.reviewNotes : undefined;
    const reasonBase = request.justification.slice(0, 4000);
    const reason = reviewNotes
      ? `Workflow approved. Review: ${reviewNotes}. Original: ${reasonBase}`
      : `Workflow approved. Original request: ${reasonBase}`;

    await this.statusChanges.changeEnrollmentStatus({
      institutionId,
      actorUserId,
      studentId: request.studentId,
      toStatus: StudentEnrollmentStatusEnum.ACTIVE,
      reason,
    });

    await this.prisma.reactivationRequest.update({
      where: { id: request.id },
      data: {
        status: ReactivationRequestStatus.APPROVED,
        reviewedBy: actorUserId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes ?? null,
      },
    });

    this.audit.append({
      institutionId,
      actorId: actorUserId,
      action: 'workflow.completed:STUDENT_REACTIVATION',
      entity: 'ReactivationRequest',
      entityId: request.id,
      newValues: {
        studentId: request.studentId,
        billingImplication: 'GAIN',
      },
    });
  }

  private async completeBackfill(
    institutionId: string,
    backfillRequestId: string,
    actorUserId: string,
  ): Promise<void> {
    const request = await this.prisma.backfillRequest.findFirst({
      where: { id: backfillRequestId, institutionId },
    });
    if (!request || request.status === BackfillRequestStatus.APPROVED) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.backfillWindow.updateMany({
        where: {
          institutionId,
          studentId: request.studentId,
          isActive: true,
          fromDate: { lte: request.toDate },
          toDate: { gte: request.fromDate },
        },
        data: { isActive: false },
      });

      await tx.backfillWindow.create({
        data: {
          institutionId,
          entityId: request.entityId,
          studentId: request.studentId,
          backfillRequestId: request.id,
          fromDate: request.fromDate,
          toDate: request.toDate,
          isActive: true,
        },
      });

      await tx.backfillRequest.update({
        where: { id: request.id },
        data: { status: BackfillRequestStatus.APPROVED },
      });
    });

    const student = await this.prisma.student.findFirst({
      where: { id: request.studentId, institutionId },
      select: { studentNumber: true },
    });

    let retroInvoice: { invoiceId: string; amount: string } | null = null;
    const retroPayload = {
      institutionId,
      entityId: request.entityId,
      backfillRequestId: request.id,
      studentId: request.studentId,
      studentNumber: student?.studentNumber ?? request.studentId,
      fromDateIso: request.fromDate.toISOString(),
      toDateIso: request.toDate.toISOString(),
    };
    const queued = await this.billingJobs.enqueueRetroactiveInvoice(retroPayload);
    if (!queued) {
      try {
        const inv = await this.billingInvoices.generateRetroactiveInvoiceForBackfill({
          institutionId,
          entityId: request.entityId,
          backfillRequestId: request.id,
          studentId: request.studentId,
          studentNumber: retroPayload.studentNumber,
          fromDate: request.fromDate,
          toDate: request.toDate,
        });
        retroInvoice = { invoiceId: inv.invoiceId, amount: inv.amount };
      } catch (err) {
        this.log.error(
          err instanceof Error ? err.message : 'Retroactive invoice generation failed',
        );
      }
    }

    this.audit.append({
      institutionId,
      actorId: actorUserId,
      action: 'workflow.completed:BACKFILL_REQUEST',
      entity: 'BackfillRequest',
      entityId: request.id,
      newValues: {
        status: BackfillRequestStatus.APPROVED,
        billingImplication: 'RETROACTIVE_GAIN',
        retroactiveInvoiceId: retroInvoice?.invoiceId ?? null,
        retroactiveAmount: retroInvoice?.amount ?? null,
      },
    });
  }

  private async completeGradeOverride(
    institutionId: string,
    gradeOverrideId: string,
    actorUserId: string,
  ) {
    const o = await this.prisma.gradeOverride.findFirst({
      where: { id: gradeOverrideId, institutionId, deletedAt: null },
    });
    if (!o || o.approvedById) {
      return;
    }
    const proposed = this.asGradeJson(o.newGrade);
    const applied: Record<string, unknown> = {
      ...proposed,
      workflowStatus: 'APPROVED',
      lastUpdatedBy: actorUserId,
      updatedAt: new Date().toISOString(),
    };
    if (typeof applied.score === 'number') {
      const clamped = await this.resitGrades.clampNumericScoreForEnrollment(
        institutionId,
        o.enrollmentId,
        applied.score,
      );
      applied.score = clamped.score;
    }
    await this.gradesRepo.approveGradeOverrideAndApplyEnrollment({
      overrideId: o.id,
      approvedById: actorUserId,
      enrollmentId: o.enrollmentId,
      grade: applied as Prisma.InputJsonValue,
    });
    this.audit.append({
      institutionId,
      actorId: actorUserId,
      action: 'workflow.completed:GRADE_OVERRIDE',
      entity: 'GradeOverride',
      entityId: o.id,
      newValues: { enrollmentId: o.enrollmentId },
    });
  }

  private asGradeJson(g: unknown): Record<string, unknown> {
    if (g && typeof g === 'object' && !Array.isArray(g)) {
      return { ...(g as Record<string, unknown>) };
    }
    return {};
  }

  private async completeGradeReleaseReview(
    institutionId: string,
    enrollmentId: string,
    actorUserId: string,
  ): Promise<void> {
    this.audit.append({
      institutionId,
      actorId: actorUserId,
      action: 'workflow.completed:GRADE_RELEASE',
      entity: 'StudentEnrollment',
      entityId: enrollmentId,
      newValues: { acknowledged: true },
    });
  }

  private async downgradeEnrollmentGradeSubmission(institutionId: string, enrollmentId: string) {
    const row = await this.prisma.studentEnrollment.findFirst({
      where: { id: enrollmentId, institutionId, deletedAt: null },
      select: { grade: true },
    });
    if (!row?.grade || typeof row.grade !== 'object' || Array.isArray(row.grade)) {
      return;
    }
    const g = { ...(row.grade as Record<string, unknown>) };
    if (g.workflowStatus !== 'SUBMITTED') {
      return;
    }
    g.workflowStatus = 'DRAFT';
    await this.prisma.studentEnrollment.update({
      where: { id: enrollmentId },
      data: { grade: g as Prisma.InputJsonValue },
    });
  }

  private async completePermanentDeletion(
    institutionId: string,
    studentId: string,
    actorUserId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const typedStudentNumber =
      typeof metadata.typedStudentNumber === 'string' ? metadata.typedStudentNumber : undefined;
    await this.studentDeletion.execute({
      institutionId,
      studentId,
      actorUserId,
      typedStudentNumber,
      workflowInstanceId:
        typeof metadata.workflowInstanceId === 'string' ? metadata.workflowInstanceId : undefined,
    });
    this.audit.append({
      institutionId,
      actorId: actorUserId,
      action: 'workflow.completed:STUDENT_PERMANENT_DELETION',
      entity: 'Student',
      entityId: studentId,
      newValues: { billingImplication: 'NONE' },
    });
  }
}
