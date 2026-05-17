import { Injectable } from '@nestjs/common';
import { AppraisalStatus, LeaveStatus, Prisma, WorkflowStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { PreparedWorkflowInitiation } from '../workflow-engine/workflow.types';

const profileInclude = {
  user: { select: { id: true, email: true, profile: true } },
  orgUnit: { select: { id: true, name: true, code: true } },
  position: { select: { id: true, title: true, code: true } },
} satisfies Prisma.StaffProfileInclude;

@Injectable()
export class StaffRepository {
  constructor(private readonly prisma: PrismaService) {}

  listProfiles(institutionId: string, entityId?: string) {
    return this.prisma.staffProfile.findMany({
      where: {
        institutionId,
        deletedAt: null,
        ...(entityId ? { entityId } : {}),
      },
      include: profileInclude,
      orderBy: { staffNumber: 'asc' },
    });
  }

  findProfile(institutionId: string, id: string, entityId?: string) {
    return this.prisma.staffProfile.findFirst({
      where: {
        id,
        institutionId,
        deletedAt: null,
        ...(entityId ? { entityId } : {}),
      },
      include: profileInclude,
    });
  }

  findProfileByUserId(institutionId: string, userId: string) {
    return this.prisma.staffProfile.findFirst({
      where: { institutionId, userId, deletedAt: null },
      include: profileInclude,
    });
  }

  createProfile(data: Prisma.StaffProfileUncheckedCreateInput) {
    return this.prisma.staffProfile.create({ data, include: profileInclude });
  }

  updateProfile(institutionId: string, id: string, data: Prisma.StaffProfileUncheckedUpdateInput) {
    return this.prisma.staffProfile.updateMany({
      where: { id, institutionId, deletedAt: null },
      data,
    });
  }

  listLeaveTypes(institutionId: string, entityId: string) {
    return this.prisma.leaveType.findMany({
      where: { institutionId, entityId },
      orderBy: { name: 'asc' },
    });
  }

  createLeaveType(data: Prisma.LeaveTypeUncheckedCreateInput) {
    return this.prisma.leaveType.create({ data });
  }

  findLeaveBalance(
    institutionId: string,
    staffId: string,
    leaveTypeId: string,
    academicYearId: string,
  ) {
    return this.prisma.leaveBalance.findFirst({
      where: { institutionId, staffId, leaveTypeId, academicYearId },
    });
  }

  upsertLeaveBalance(data: Prisma.LeaveBalanceUncheckedCreateInput) {
    return this.prisma.leaveBalance.upsert({
      where: {
        staffId_leaveTypeId_academicYearId: {
          staffId: data.staffId,
          leaveTypeId: data.leaveTypeId,
          academicYearId: data.academicYearId,
        },
      },
      create: data,
      update: {
        allocated: data.allocated,
        carriedOver: data.carriedOver,
      },
    });
  }

  incrementLeavePending(balanceId: string, days: number) {
    return this.prisma.leaveBalance.update({
      where: { id: balanceId },
      data: { pending: { increment: days } },
    });
  }

  finalizeLeaveApproval(balanceId: string, days: number) {
    return this.prisma.leaveBalance.update({
      where: { id: balanceId },
      data: {
        pending: { decrement: days },
        used: { increment: days },
      },
    });
  }

  releaseLeavePending(balanceId: string, days: number) {
    return this.prisma.leaveBalance.update({
      where: { id: balanceId },
      data: { pending: { decrement: days } },
    });
  }

  listLeaveRequests(institutionId: string, entityId?: string, staffId?: string) {
    return this.prisma.leaveRequest.findMany({
      where: {
        institutionId,
        ...(entityId ? { entityId } : {}),
        ...(staffId ? { staffId } : {}),
      },
      include: {
        leaveType: { select: { id: true, name: true, code: true } },
        staff: {
          select: {
            id: true,
            staffNumber: true,
            user: { select: { email: true, profile: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findLeaveRequest(institutionId: string, id: string) {
    return this.prisma.leaveRequest.findFirst({
      where: { id, institutionId },
      include: {
        leaveType: true,
        staff: { include: { user: { select: { id: true, email: true, profile: true } } } },
      },
    });
  }

  updateLeaveRequestStatus(institutionId: string, id: string, status: LeaveStatus) {
    return this.prisma.leaveRequest.updateMany({
      where: { id, institutionId },
      data: { status },
    });
  }

  async createLeaveRequestWithWorkflow(
    leave: Prisma.LeaveRequestUncheckedCreateInput,
    workflow: PreparedWorkflowInitiation,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.leaveRequest.create({
        data: { ...leave, status: LeaveStatus.PENDING },
      });
      const instance = await tx.workflowInstance.create({
        data: {
          institutionId: workflow.institutionId,
          entityId: workflow.entityId,
          definitionId: workflow.definitionId,
          definitionCode: workflow.definitionCode,
          entityType: workflow.entityType,
          entityId_record: request.id,
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
      const updated = await tx.leaveRequest.update({
        where: { id: request.id },
        data: { workflowInstanceId: instance.id },
      });
      return { request: updated, workflowInstance: instance };
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

  async createAppraisalWithWorkflow(
    appraisal: Prisma.StaffAppraisalUncheckedCreateInput,
    workflow: PreparedWorkflowInitiation,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.staffAppraisal.create({
        data: { ...appraisal, status: AppraisalStatus.PENDING_REVIEW },
      });
      const instance = await tx.workflowInstance.create({
        data: {
          institutionId: workflow.institutionId,
          entityId: workflow.entityId,
          definitionId: workflow.definitionId,
          definitionCode: workflow.definitionCode,
          entityType: workflow.entityType,
          entityId_record: row.id,
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
        where: { id: row.id },
        data: { workflowInstanceId: instance.id },
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

  listWorkload(institutionId: string, entityId: string, semesterId: string) {
    return this.prisma.workloadRecord.findMany({
      where: { institutionId, entityId, semesterId },
      include: {
        staff: {
          select: {
            id: true,
            staffNumber: true,
            user: { select: { email: true, profile: true } },
          },
        },
      },
    });
  }

  upsertWorkload(data: Prisma.WorkloadRecordUncheckedCreateInput) {
    return this.prisma.workloadRecord.upsert({
      where: {
        staffId_semesterId: { staffId: data.staffId, semesterId: data.semesterId },
      },
      create: data,
      update: {
        assignedSections: data.assignedSections,
        totalCreditHours: data.totalCreditHours,
        maxCreditHours: data.maxCreditHours,
        researchHours: data.researchHours,
        adminHours: data.adminHours,
      },
      include: {
        staff: {
          select: {
            id: true,
            staffNumber: true,
            user: { select: { email: true, profile: true } },
          },
        },
      },
    });
  }

  orgUnitsWithHolders(institutionId: string, entityId: string) {
    return this.prisma.orgUnit.findMany({
      where: { institutionId, entityId, deletedAt: null },
      include: {
        positions: {
          where: { deletedAt: null },
          include: {
            holders: {
              where: { OR: [{ endDate: null }, { endDate: { gt: new Date() } }] },
              include: {
                user: { select: { id: true, email: true, profile: true } },
              },
            },
          },
        },
        staffProfiles: {
          where: { deletedAt: null },
          include: profileInclude,
        },
      },
      orderBy: { name: 'asc' },
    });
  }
}
