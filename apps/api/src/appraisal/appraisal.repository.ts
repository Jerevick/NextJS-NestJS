import { Injectable } from '@nestjs/common';
import { AppraisalStatus, Prisma, WorkflowStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { PreparedWorkflowInitiation } from '../workflow-engine/workflow.types';

const profileInclude = {
  user: { select: { id: true, email: true, profile: true } },
  entity: { select: { id: true, code: true, name: true } },
  orgUnit: { select: { id: true, name: true, code: true } },
  position: { select: { id: true, title: true, code: true, level: true } },
} satisfies Prisma.StaffProfileInclude;

@Injectable()
export class AppraisalRepository {
  constructor(private readonly prisma: PrismaService) {}

  createAppraisalDraft(data: Prisma.StaffAppraisalUncheckedCreateInput) {
    return this.prisma.staffAppraisal.create({
      data: { ...data, status: AppraisalStatus.DRAFT },
    });
  }

  listAppraisals(institutionId: string, entityId?: string, staffId?: string) {
    return this.prisma.staffAppraisal.findMany({
      where: {
        institutionId,
        ...(entityId ? { entityId } : {}),
        ...(staffId ? { staffId } : {}),
      },
      include: {
        staff: {
          select: {
            id: true,
            staffNumber: true,
            positionId: true,
            user: { select: { email: true, profile: true } },
          },
        },
        reviewer: { select: { id: true, email: true, profile: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findAppraisal(institutionId: string, id: string) {
    return this.prisma.staffAppraisal.findFirst({
      where: { id, institutionId },
      include: {
        staff: { include: profileInclude },
        reviewer: { select: { id: true, email: true, profile: true } },
      },
    });
  }

  async submitAppraisalWithWorkflow(appraisalId: string, workflow: PreparedWorkflowInitiation) {
    return this.prisma.$transaction(async (tx) => {
      const instance = await tx.workflowInstance.create({
        data: {
          institutionId: workflow.institutionId,
          entityId: workflow.entityId,
          definitionId: workflow.definitionId,
          definitionCode: workflow.definitionCode,
          entityType: workflow.entityType,
          entityId_record: appraisalId,
          currentStep: 1,
          status: WorkflowStatus.IN_PROGRESS,
          initiatedBy: workflow.initiatedBy,
          dueAt: workflow.dueAt,
          metadata: workflow.metadata as Prisma.InputJsonValue,
          currentAssigneeUserId: workflow.currentAssigneeUserId,
          currentStepName: workflow.currentStepName,
          assigneePositionCode: workflow.assigneePositionCode,
          history: [],
        },
      });
      const updated = await tx.staffAppraisal.update({
        where: { id: appraisalId },
        data: {
          workflowInstanceId: instance.id,
          status: AppraisalStatus.PENDING_REVIEW,
        },
      });
      return { appraisal: updated, workflowInstance: instance };
    });
  }

  updateAppraisal(institutionId: string, id: string, data: Prisma.StaffAppraisalUpdateInput) {
    return this.prisma.staffAppraisal.updateMany({
      where: { id, institutionId },
      data,
    });
  }
}
