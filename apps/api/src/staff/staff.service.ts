import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppraisalStatus, LeaveStatus, Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import type { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import type { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import type { CreateStaffAppraisalDto } from './dto/create-appraisal.dto';
import type { CreateStaffProfileDto } from './dto/create-staff-profile.dto';
import type { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
import type { UpsertWorkloadDto } from './dto/upsert-workload.dto';
import { leaveBalanceAvailable, leaveDurationDays } from './staff-leave.util';
import { PrismaService } from '../prisma/prisma.service';
import { StaffRepository } from './staff.repository';
import {
  createAppraisalWithWorkflowAtomic,
  createLeaveRequestWithWorkflowAtomic,
} from './staff-workflow.util';

@Injectable()
export class StaffService {
  constructor(
    private readonly repo: StaffRepository,
    private readonly prisma: PrismaService,
    private readonly workflows: WorkflowEngineService,
    private readonly audit: AuditService,
  ) {}

  private entityId(user: AuthUser) {
    if (!user.entityId) {
      throw new BadRequestException('X-Entity-ID header is required for staff operations');
    }
    return user.entityId;
  }

  private async assertStaffAccess(actor: AuthUser, staffId: string, requireWrite = false) {
    const profile = await this.repo.findProfile(actor.institutionId, staffId);
    if (!profile) throw new NotFoundException('Staff profile not found');
    if (profile.userId === actor.userId) return profile;
    const perm = requireWrite ? 'staff.write' : 'staff.read';
    if (!actor.permissions?.includes('*') && !actor.permissions?.includes(perm)) {
      throw new ForbiddenException(`Requires ${perm}`);
    }
    return profile;
  }

  listProfiles(user: AuthUser) {
    const entityId =
      user.permissions?.includes('staff.read') || user.permissions?.includes('staff.write')
        ? this.entityId(user)
        : user.entityId;
    return this.repo.listProfiles(user.institutionId, entityId).then((rows) => ({
      data: rows.map((r) => this.mapProfile(r)),
    }));
  }

  async getProfile(user: AuthUser, id: string) {
    const row = await this.repo.findProfile(user.institutionId, id, this.entityId(user));
    if (!row) throw new NotFoundException('Staff profile not found');
    return this.mapProfile(row);
  }

  async getMyProfile(user: AuthUser) {
    const row = await this.repo.findProfileByUserId(user.institutionId, user.userId);
    if (!row) throw new NotFoundException('No staff profile linked to your account');
    return this.mapProfile(row);
  }

  async createProfile(user: AuthUser, dto: CreateStaffProfileDto) {
    const entityId = this.entityId(user);
    const existing = await this.repo.findProfileByUserId(user.institutionId, dto.userId);
    if (existing) throw new BadRequestException('User already has a staff profile');
    const row = await this.repo.createProfile({
      institutionId: user.institutionId,
      entityId,
      userId: dto.userId,
      staffNumber: dto.staffNumber.trim(),
      orgUnitId: dto.orgUnitId,
      positionId: dto.positionId,
      employmentType: dto.employmentType,
      contractStart: dto.contractStart ? new Date(dto.contractStart) : undefined,
      contractEnd: dto.contractEnd ? new Date(dto.contractEnd) : undefined,
      officeLocation: dto.officeLocation,
      specializations: dto.specializations ?? [],
      researchInterests: dto.researchInterests ?? [],
    });
    this.audit.append({
      institutionId: user.institutionId,
      actorId: user.userId,
      action: 'staff.profile.created',
      entity: 'StaffProfile',
      entityId: row.id,
    });
    return this.mapProfile(row);
  }

  async updateProfile(user: AuthUser, id: string, dto: UpdateStaffProfileDto) {
    await this.repo.findProfile(user.institutionId, id, this.entityId(user));
    await this.repo.updateProfile(user.institutionId, id, {
      orgUnitId: dto.orgUnitId,
      positionId: dto.positionId,
      employmentType: dto.employmentType,
      contractStart: dto.contractStart ? new Date(dto.contractStart) : undefined,
      contractEnd: dto.contractEnd ? new Date(dto.contractEnd) : undefined,
      officeLocation: dto.officeLocation,
      specializations: dto.specializations,
      researchInterests: dto.researchInterests,
    });
    const row = await this.repo.findProfile(user.institutionId, id, this.entityId(user));
    return this.mapProfile(row!);
  }

  listLeaveTypes(user: AuthUser) {
    return this.repo
      .listLeaveTypes(user.institutionId, this.entityId(user))
      .then((data) => ({ data }));
  }

  async createLeaveType(user: AuthUser, dto: CreateLeaveTypeDto) {
    const entityId = this.entityId(user);
    const row = await this.repo.createLeaveType({
      institutionId: user.institutionId,
      entityId,
      name: dto.name.trim(),
      code: dto.code.trim().toUpperCase(),
      annualAllocation: dto.annualAllocation ?? 0,
      carryOverLimit: dto.carryOverLimit ?? 0,
      requiresApproval: dto.requiresApproval ?? true,
      isPaid: dto.isPaid ?? true,
    });
    return row;
  }

  async ensureLeaveBalance(
    user: AuthUser,
    staffId: string,
    leaveTypeId: string,
    academicYearId: string,
  ) {
    const staff = await this.assertStaffAccess(user, staffId);
    const leaveType = await this.repo.listLeaveTypes(user.institutionId, staff.entityId);
    const lt = leaveType.find((t) => t.id === leaveTypeId);
    if (!lt) throw new NotFoundException('Leave type not found');
    const existing = await this.repo.findLeaveBalance(
      user.institutionId,
      staffId,
      leaveTypeId,
      academicYearId,
    );
    if (existing) return existing;
    return this.repo.upsertLeaveBalance({
      institutionId: user.institutionId,
      entityId: staff.entityId,
      staffId,
      leaveTypeId,
      academicYearId,
      allocated: lt.annualAllocation,
      carriedOver: 0,
      used: 0,
      pending: 0,
    });
  }

  listLeaveRequests(user: AuthUser, staffId?: string) {
    const entityId = this.entityId(user);
    return this.repo
      .listLeaveRequests(user.institutionId, entityId, staffId)
      .then((data) => ({ data }));
  }

  async createLeaveRequest(user: AuthUser, dto: CreateLeaveRequestDto) {
    const staff = await this.assertStaffAccess(user, dto.staffId);
    if (
      staff.userId !== user.userId &&
      !user.permissions?.includes('*') &&
      !user.permissions?.includes('staff.write')
    ) {
      throw new ForbiddenException('Cannot submit leave for another staff member');
    }
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) throw new BadRequestException('endDate must be on or after startDate');
    const durationDays = leaveDurationDays(start, end);
    const balance = await this.ensureLeaveBalance(
      user,
      dto.staffId,
      dto.leaveTypeId,
      dto.academicYearId,
    );
    const available = leaveBalanceAvailable(balance);
    if (durationDays > available) {
      throw new BadRequestException(
        `Insufficient leave balance (${available} days available, ${durationDays} requested)`,
      );
    }
    await this.repo.incrementLeavePending(balance.id, durationDays);
    const { request } = await createLeaveRequestWithWorkflowAtomic(
      this.workflows,
      this.repo,
      this.audit,
      {
        institutionId: user.institutionId,
        entityId: staff.entityId,
        staffId: dto.staffId,
        leaveTypeId: dto.leaveTypeId,
        startDate: start,
        endDate: end,
        durationDays,
        reason: dto.reason.trim(),
        supportingDocKey: dto.supportingDocKey,
        coveringStaffId: dto.coveringStaffId,
      },
      {
        institutionId: user.institutionId,
        entityId: staff.entityId,
        definitionCode: 'LEAVE_REQUEST',
        entityType: 'LeaveRequest',
        initiatedBy: user.userId,
        metadata: {
          staffId: dto.staffId,
          leaveTypeId: dto.leaveTypeId,
          durationDays,
        },
      },
    );
    return request;
  }

  listAppraisals(user: AuthUser, staffId?: string) {
    return this.repo
      .listAppraisals(user.institutionId, this.entityId(user), staffId)
      .then((data) => ({ data }));
  }

  async createAppraisal(user: AuthUser, dto: CreateStaffAppraisalDto) {
    const staff = await this.repo.findProfile(user.institutionId, dto.staffId, this.entityId(user));
    if (!staff) throw new NotFoundException('Staff profile not found');
    const { appraisal } = await createAppraisalWithWorkflowAtomic(
      this.workflows,
      this.repo,
      this.audit,
      {
        institutionId: user.institutionId,
        entityId: staff.entityId,
        staffId: dto.staffId,
        reviewerId: dto.reviewerId,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        type: dto.type,
      },
      {
        institutionId: user.institutionId,
        entityId: staff.entityId,
        definitionCode: 'STAFF_APPRAISAL',
        entityType: 'StaffAppraisal',
        initiatedBy: user.userId,
        metadata: { staffId: dto.staffId },
      },
    );
    return appraisal;
  }

  async updateAppraisal(
    user: AuthUser,
    id: string,
    body: {
      selfAssessment?: string;
      kpiScores?: Record<string, unknown>;
      peerFeedback?: unknown[];
    },
  ) {
    const row = await this.repo.findAppraisal(user.institutionId, id);
    if (!row) throw new NotFoundException('Appraisal not found');
    if (row.staff.userId !== user.userId && !user.permissions?.includes('staff.write')) {
      throw new ForbiddenException('Cannot edit this appraisal');
    }
    await this.repo.updateAppraisal(user.institutionId, id, {
      selfAssessment: body.selfAssessment,
      kpiScores: body.kpiScores as Prisma.InputJsonValue,
      peerFeedback: body.peerFeedback as Prisma.InputJsonValue,
      status:
        body.selfAssessment && row.status === AppraisalStatus.DRAFT
          ? AppraisalStatus.SELF_REVIEW
          : undefined,
    });
    return this.repo.findAppraisal(user.institutionId, id);
  }

  listWorkload(user: AuthUser, semesterId: string) {
    return this.repo
      .listWorkload(user.institutionId, this.entityId(user), semesterId)
      .then((data) => ({
        data: data.map((w) => ({
          ...w,
          utilizationPct:
            w.maxCreditHours > 0 ? Math.round((w.totalCreditHours / w.maxCreditHours) * 100) : 0,
          overCapacity: w.totalCreditHours > w.maxCreditHours,
        })),
      }));
  }

  async upsertWorkload(user: AuthUser, dto: UpsertWorkloadDto) {
    const staff = await this.repo.findProfile(user.institutionId, dto.staffId, this.entityId(user));
    if (!staff) throw new NotFoundException('Staff profile not found');
    const maxHours = dto.maxCreditHours ?? 18;
    const total = dto.totalCreditHours ?? 0;
    const row = await this.repo.upsertWorkload({
      institutionId: user.institutionId,
      entityId: staff.entityId,
      staffId: dto.staffId,
      semesterId: dto.semesterId,
      assignedSections: (dto.assignedSections ?? []) as Prisma.InputJsonValue,
      totalCreditHours: total,
      maxCreditHours: maxHours,
      researchHours: dto.researchHours ?? 0,
      adminHours: dto.adminHours ?? 0,
    });
    return {
      ...row,
      utilizationPct: maxHours > 0 ? Math.round((total / maxHours) * 100) : 0,
      overCapacity: total > maxHours,
      warning: total > maxHours ? 'Credit hours exceed configured maximum' : undefined,
    };
  }

  async orgChart(user: AuthUser, entityId: string) {
    const units = await this.repo.orgUnitsWithHolders(user.institutionId, entityId);
    const roots = units.filter((u) => !u.parentId);
    const byParent = new Map<string | null, typeof units>();
    for (const u of units) {
      const key = u.parentId ?? null;
      const list = byParent.get(key) ?? [];
      list.push(u);
      byParent.set(key, list);
    }
    const build = (parentId: string | null): unknown[] =>
      (byParent.get(parentId) ?? []).map((unit) => ({
        id: unit.id,
        name: unit.name,
        code: unit.code,
        staff: unit.staffProfiles.map((s) => this.mapProfile(s)),
        positions: unit.positions.map((p) => ({
          id: p.id,
          title: p.title,
          code: p.code,
          holders: p.holders.map((h) => ({
            userId: h.userId,
            email: h.user.email,
            profile: h.user.profile,
            isActing: h.isActing,
          })),
        })),
        children: build(unit.id),
      }));
    return { entityId, tree: build(null) };
  }

  async completeLeaveFromWorkflow(institutionId: string, leaveRequestId: string) {
    const req = await this.repo.findLeaveRequest(institutionId, leaveRequestId);
    if (!req || req.status !== LeaveStatus.PENDING) return;
    const year = await this.academicYearForLeave(req);
    const balance = await this.repo.findLeaveBalance(
      institutionId,
      req.staffId,
      req.leaveTypeId,
      year.id,
    );
    if (balance) {
      await this.repo.finalizeLeaveApproval(balance.id, req.durationDays);
    }
    await this.repo.updateLeaveRequestStatus(institutionId, leaveRequestId, LeaveStatus.APPROVED);
  }

  async rejectLeaveFromWorkflow(institutionId: string, leaveRequestId: string) {
    const req = await this.repo.findLeaveRequest(institutionId, leaveRequestId);
    if (!req || req.status !== LeaveStatus.PENDING) return;
    const year = await this.academicYearForLeave(req);
    const balance = await this.repo.findLeaveBalance(
      institutionId,
      req.staffId,
      req.leaveTypeId,
      year.id,
    );
    if (balance) {
      await this.repo.releaseLeavePending(balance.id, req.durationDays);
    }
    await this.repo.updateLeaveRequestStatus(institutionId, leaveRequestId, LeaveStatus.REJECTED);
  }

  async completeAppraisalFromWorkflow(institutionId: string, appraisalId: string) {
    await this.repo.updateAppraisal(institutionId, appraisalId, {
      status: AppraisalStatus.COMPLETED,
    });
  }

  async rejectAppraisalFromWorkflow(institutionId: string, appraisalId: string) {
    await this.repo.updateAppraisal(institutionId, appraisalId, {
      status: AppraisalStatus.REJECTED,
    });
  }

  private async academicYearForLeave(req: { startDate: Date; institutionId: string }) {
    const year = await this.prisma.academicYear.findFirst({
      where: {
        institutionId: req.institutionId,
        startDate: { lte: req.startDate },
        endDate: { gte: req.startDate },
        deletedAt: null,
      },
      orderBy: { startDate: 'desc' },
    });
    if (!year) throw new BadRequestException('No academic year covers leave dates');
    return year;
  }

  private mapProfile(row: Awaited<ReturnType<StaffRepository['findProfile']>> & object) {
    const profile = row.user.profile as Record<string, unknown> | null;
    const joined = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ');
    const name =
      (profile?.displayName as string) ?? (profile?.name as string) ?? (joined || row.user.email);
    return {
      id: row.id,
      staffNumber: row.staffNumber,
      entityId: row.entityId,
      userId: row.userId,
      email: row.user.email,
      name,
      employmentType: row.employmentType,
      officeLocation: row.officeLocation,
      orgUnit: row.orgUnit,
      position: row.position,
      specializations: row.specializations,
      researchInterests: row.researchInterests,
    };
  }
}
