import { Injectable, Logger } from '@nestjs/common';
import {
  BackfillRequestStatus,
  ReactivationRequestStatus,
  StudentEnrollmentStatusEnum,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BillingInvoiceService } from '../billing/billing-invoice.service';
import { BillingJobsService } from '../billing/jobs/billing-jobs.service';
import { StudentDeletionService } from '../students/deletion/student-deletion.service';
import { StatusChangeService } from '../students/status/status-change.service';

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
        await this.completePermanentDeletion(
          institutionId,
          entityId_record,
          actorUserId,
          metadata,
        );
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
      default:
        break;
    }
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

    const reviewNotes =
      typeof metadata.reviewNotes === 'string' ? metadata.reviewNotes : undefined;
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
