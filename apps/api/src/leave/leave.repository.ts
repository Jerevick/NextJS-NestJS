import { Injectable } from '@nestjs/common';
import { LeaveStatus, Prisma, WorkflowStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { PreparedWorkflowInitiation } from '../workflow-engine/workflow.types';

@Injectable()
export class LeaveRepository {
  constructor(private readonly prisma: PrismaService) {}

  listLeaveBalances(institutionId: string, entityId: string, staffId?: string) {
    return this.prisma.leaveBalance.findMany({
      where: {
        institutionId,
        entityId,
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
        academicYear: { select: { id: true, name: true } },
      },
    });
  }

  listApprovedLeaveInRange(institutionId: string, entityId: string, from: Date, to: Date) {
    return this.prisma.leaveRequest.findMany({
      where: {
        institutionId,
        entityId,
        status: LeaveStatus.APPROVED,
        startDate: { lte: to },
        endDate: { gte: from },
      },
      include: {
        leaveType: { select: { name: true, code: true } },
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

  updateLeaveRequestMeta(
    institutionId: string,
    id: string,
    data: { metadata?: Prisma.InputJsonValue; calendarBlockedAt?: Date | null },
  ) {
    return this.prisma.leaveRequest.updateMany({
      where: { id, institutionId },
      data,
    });
  }

  listLeaveTypes(institutionId: string, entityId: string) {
    return this.prisma.leaveType.findMany({
      where: { institutionId, entityId },
      orderBy: { name: 'asc' },
    });
  }

  findLeaveType(institutionId: string, entityId: string, id: string) {
    return this.prisma.leaveType.findFirst({
      where: { id, institutionId, entityId },
    });
  }

  createLeaveType(data: Prisma.LeaveTypeUncheckedCreateInput) {
    return this.prisma.leaveType.create({ data });
  }

  updateLeaveType(
    institutionId: string,
    entityId: string,
    id: string,
    data: Prisma.LeaveTypeUncheckedUpdateInput,
  ) {
    return this.prisma.leaveType.updateMany({
      where: { id, institutionId, entityId },
      data,
    });
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

  createLeaveRequest(data: Prisma.LeaveRequestUncheckedCreateInput) {
    return this.prisma.leaveRequest.create({ data });
  }
}
