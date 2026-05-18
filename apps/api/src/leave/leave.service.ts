import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaveStatus, Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import type { AllocateLeaveBalanceDto } from '../staff/dto/allocate-leave-balance.dto';
import type { CarryForwardLeaveDto } from '../staff/dto/carry-forward-leave.dto';
import type { CreateLeaveRequestDto } from '../staff/dto/create-leave-request.dto';
import type { CreateLeaveTypeDto } from '../staff/dto/create-leave-type.dto';
import type { RegisterExternalCalendarDto } from '../staff/dto/register-external-calendar.dto';
import { StaffCalendarIntegrationService } from '../staff/staff-calendar-integration.service';
import {
  buildLeaveIcsFeed,
  googleCalendarBlockUrl,
  outlookCalendarBlockUrl,
} from '../staff/staff-calendar.util';
import { leaveBalanceAvailable, leaveDurationDays } from '../staff/staff-leave.util';
import { StaffNotificationsService } from '../staff/staff-notifications.service';
import { StaffRepository } from '../staff/staff.repository';
import type { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';
import { LeaveRepository } from './leave.repository';
import { createLeaveRequestWithWorkflowAtomic } from './leave-workflow.util';

@Injectable()
export class LeaveService {
  constructor(
    private readonly repo: LeaveRepository,
    private readonly staffRepo: StaffRepository,
    private readonly prisma: PrismaService,
    private readonly workflows: WorkflowEngineService,
    private readonly audit: AuditService,
    private readonly staffNotify: StaffNotificationsService,
    private readonly calendarIntegration: StaffCalendarIntegrationService,
  ) {}

  private entityId(user: AuthUser) {
    if (!user.entityId) {
      throw new BadRequestException('X-Entity-ID header is required for leave operations');
    }
    return user.entityId;
  }

  private async assertStaffAccess(actor: AuthUser, staffId: string, requireWrite = false) {
    const profile = await this.staffRepo.findProfile(actor.institutionId, staffId);
    if (!profile) throw new NotFoundException('Staff profile not found');
    if (profile.userId === actor.userId) return profile;
    const perm = requireWrite ? 'staff.write' : 'staff.read';
    if (!actor.permissions?.includes('*') && !actor.permissions?.includes(perm)) {
      throw new ForbiddenException(`Requires ${perm}`);
    }
    return profile;
  }

  listLeaveTypes(user: AuthUser) {
    return this.repo
      .listLeaveTypes(user.institutionId, this.entityId(user))
      .then((data) => ({ data }));
  }

  async createLeaveType(user: AuthUser, dto: CreateLeaveTypeDto) {
    const entityId = this.entityId(user);
    return this.repo.createLeaveType({
      institutionId: user.institutionId,
      entityId,
      name: dto.name.trim(),
      code: dto.code.trim().toUpperCase(),
      annualAllocation: dto.annualAllocation ?? 0,
      carryOverLimit: dto.carryOverLimit ?? 0,
      requiresApproval: dto.requiresApproval ?? true,
      isPaid: dto.isPaid ?? true,
    });
  }

  async updateLeaveType(user: AuthUser, id: string, dto: UpdateLeaveTypeDto) {
    const entityId = this.entityId(user);
    const existing = await this.repo.findLeaveType(user.institutionId, entityId, id);
    if (!existing) throw new NotFoundException('Leave type not found');
    const data: Prisma.LeaveTypeUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.annualAllocation !== undefined) data.annualAllocation = dto.annualAllocation;
    if (dto.carryOverLimit !== undefined) data.carryOverLimit = dto.carryOverLimit;
    if (dto.requiresApproval !== undefined) data.requiresApproval = dto.requiresApproval;
    if (dto.isPaid !== undefined) data.isPaid = dto.isPaid;
    await this.repo.updateLeaveType(user.institutionId, entityId, id, data);
    return this.repo.findLeaveType(user.institutionId, entityId, id);
  }

  async ensureLeaveBalance(
    user: AuthUser,
    staffId: string,
    leaveTypeId: string,
    academicYearId: string,
  ) {
    const staff = await this.assertStaffAccess(user, staffId);
    const leaveTypes = await this.repo.listLeaveTypes(user.institutionId, staff.entityId);
    const lt = leaveTypes.find((t) => t.id === leaveTypeId);
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

  listLeaveBalances(user: AuthUser, staffId?: string) {
    return this.repo
      .listLeaveBalances(user.institutionId, this.entityId(user), staffId)
      .then((data) => ({ data }));
  }

  async allocateLeaveBalance(user: AuthUser, dto: AllocateLeaveBalanceDto) {
    const staff = await this.staffRepo.findProfile(
      user.institutionId,
      dto.staffId,
      this.entityId(user),
    );
    if (!staff) throw new NotFoundException('Staff profile not found');
    const existing = await this.repo.findLeaveBalance(
      user.institutionId,
      dto.staffId,
      dto.leaveTypeId,
      dto.academicYearId,
    );
    return this.repo.upsertLeaveBalance({
      institutionId: user.institutionId,
      entityId: staff.entityId,
      staffId: dto.staffId,
      leaveTypeId: dto.leaveTypeId,
      academicYearId: dto.academicYearId,
      allocated: dto.allocated ?? existing?.allocated ?? 0,
      carriedOver: dto.carriedOver ?? existing?.carriedOver ?? 0,
      used: existing?.used ?? 0,
      pending: existing?.pending ?? 0,
    });
  }

  async carryForwardLeaveBalances(user: AuthUser, dto: CarryForwardLeaveDto) {
    const entityId = this.entityId(user);
    const balances = await this.repo.listLeaveBalances(user.institutionId, entityId);
    const fromRows = balances.filter((b) => b.academicYearId === dto.fromAcademicYearId);
    let count = 0;
    for (const b of fromRows) {
      const lt = await this.prisma.leaveType.findFirst({
        where: { id: b.leaveTypeId, institutionId: user.institutionId },
      });
      if (!lt) continue;
      const remaining = leaveBalanceAvailable(b);
      const carry = Math.min(remaining, lt.carryOverLimit);
      if (carry <= 0) continue;
      await this.repo.upsertLeaveBalance({
        institutionId: user.institutionId,
        entityId,
        staffId: b.staffId,
        leaveTypeId: b.leaveTypeId,
        academicYearId: dto.toAcademicYearId,
        allocated: lt.annualAllocation,
        carriedOver: carry,
        used: 0,
        pending: 0,
      });
      count += 1;
    }
    return { carriedForward: count };
  }

  leaveCalendar(user: AuthUser, fromIso: string, toIso: string) {
    const from = new Date(fromIso);
    const to = new Date(toIso);
    return this.repo
      .listApprovedLeaveInRange(user.institutionId, this.entityId(user), from, to)
      .then((rows) => ({
        events: rows.map((r) => {
          const profile = r.staff.user.profile as Record<string, unknown> | null;
          const name =
            (profile?.displayName as string) ?? (profile?.name as string) ?? r.staff.staffNumber;
          return {
            id: r.id,
            title: `${name} — ${r.leaveType.name}`,
            start: r.startDate.toISOString(),
            end: r.endDate.toISOString(),
            status: r.status,
            staffId: r.staff.id,
            staffNumber: r.staff.staffNumber,
          };
        }),
      }));
  }

  async exportLeaveCalendarIcs(user: AuthUser, fromIso: string, toIso: string) {
    const from = new Date(fromIso);
    const to = new Date(toIso);
    const rows = await this.repo.listApprovedLeaveInRange(
      user.institutionId,
      this.entityId(user),
      from,
      to,
    );
    const events = rows.map((r) => {
      const profile = r.staff.user.profile as Record<string, unknown> | null;
      const name =
        (profile?.displayName as string) ?? (profile?.name as string) ?? r.staff.staffNumber;
      return {
        id: r.id,
        title: `${name} — ${r.leaveType.name}`,
        start: r.startDate,
        end: r.endDate,
        staffEmail: r.staff.user.email,
      };
    });
    return buildLeaveIcsFeed(events);
  }

  async registerExternalCalendar(
    user: AuthUser,
    leaveRequestId: string,
    dto: RegisterExternalCalendarDto,
  ) {
    const req = await this.repo.findLeaveRequest(user.institutionId, leaveRequestId);
    if (!req) throw new NotFoundException('Leave request not found');
    if (req.status !== LeaveStatus.APPROVED) {
      throw new BadRequestException('External calendar links are available after approval');
    }
    await this.assertStaffAccess(user, req.staffId);
    const title = `${req.leaveType.name} leave`;
    const links: Record<string, string> = {
      google: googleCalendarBlockUrl(title, req.startDate, req.endDate),
      outlook: outlookCalendarBlockUrl(title, req.startDate, req.endDate),
    };
    const prior =
      req.metadata && typeof req.metadata === 'object'
        ? (req.metadata as Record<string, unknown>)
        : {};
    await this.repo.updateLeaveRequestMeta(user.institutionId, leaveRequestId, {
      metadata: {
        ...prior,
        calendarIntegration: {
          provider: dto.provider,
          externalEventId: dto.externalEventId ?? null,
          registeredAt: new Date().toISOString(),
          registeredBy: user.userId,
          links,
        },
      } as Prisma.InputJsonValue,
    });
    return { provider: dto.provider, links };
  }

  listLeaveRequests(user: AuthUser, staffId?: string) {
    const entityId = this.entityId(user);
    return this.repo
      .listLeaveRequests(user.institutionId, entityId, staffId)
      .then((data) => ({ data }));
  }

  async getLeaveRequest(user: AuthUser, id: string) {
    const req = await this.repo.findLeaveRequest(user.institutionId, id);
    if (!req) throw new NotFoundException('Leave request not found');
    if (req.entityId !== this.entityId(user)) {
      throw new NotFoundException('Leave request not found');
    }
    await this.assertStaffAccess(user, req.staffId);
    return req;
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
    const leaveType = await this.repo.findLeaveType(
      user.institutionId,
      staff.entityId,
      dto.leaveTypeId,
    );
    if (!leaveType) throw new NotFoundException('Leave type not found');
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

    if (!leaveType.requiresApproval) {
      await this.repo.incrementLeavePending(balance.id, durationDays);
      const request = await this.repo.createLeaveRequest({
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
        status: LeaveStatus.APPROVED,
      });
      await this.finalizeApprovedLeave(user.institutionId, request.id);
      return this.repo.findLeaveRequest(user.institutionId, request.id);
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

  async completeLeaveFromWorkflow(institutionId: string, leaveRequestId: string) {
    const req = await this.repo.findLeaveRequest(institutionId, leaveRequestId);
    if (!req || req.status !== LeaveStatus.PENDING) return;
    await this.finalizeApprovedLeave(institutionId, leaveRequestId);
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
    await this.staffNotify.notifyLeaveDecision(institutionId, leaveRequestId, false);
  }

  private async finalizeApprovedLeave(institutionId: string, leaveRequestId: string) {
    const req = await this.repo.findLeaveRequest(institutionId, leaveRequestId);
    if (!req) return;
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
    const title = `${req.leaveType.name} leave`;
    const staffUser = req.staff.user;
    const push = await this.calendarIntegration.pushLeaveToConnectedCalendars({
      staffUserId: staffUser.id,
      staffProfile: staffUser.profile as Record<string, unknown> | null,
      title,
      start: req.startDate,
      end: req.endDate,
      leaveRequestId,
    });
    await this.repo.updateLeaveRequestMeta(institutionId, leaveRequestId, {
      calendarBlockedAt: new Date(),
      metadata: {
        blockedRange: { start: req.startDate.toISOString(), end: req.endDate.toISOString() },
        calendarIntegration: {
          blockedAt: new Date().toISOString(),
          googleEventId: push.googleEventId ?? null,
          microsoftEventId: push.microsoftEventId ?? null,
          links: push.deepLinks,
        },
      } as Prisma.InputJsonValue,
    });
    await this.staffNotify.notifyLeaveDecision(institutionId, leaveRequestId, true);
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
}
