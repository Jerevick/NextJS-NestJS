import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { Prisma, WorkflowStatus } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import type { AllocateLeaveBalanceDto } from './dto/allocate-leave-balance.dto';
import type { CarryForwardLeaveDto } from './dto/carry-forward-leave.dto';
import type { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import type { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import type { RegisterExternalCalendarDto } from './dto/register-external-calendar.dto';
import { AppraisalService } from '../appraisal/appraisal.service';
import { LeaveService } from '../leave/leave.service';
import type { CreateStaffProfileDto } from './dto/create-staff-profile.dto';
import type { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
import type { UpsertWorkloadDto } from './dto/upsert-workload.dto';
import type { ApplyWorkloadSuggestionsDto } from './dto/apply-workload-suggestions.dto';
import type { GrantStaffEntityAccessDto } from './dto/grant-staff-entity-access.dto';
import type { ListStaffProfilesQueryDto } from './dto/list-staff-profiles-query.dto';
import { StaffNotificationsService } from './staff-notifications.service';
import { decryptSalary, encryptSalary } from './staff-salary.util';
import { parseEntityHrSettings, suggestWorkloadDistribution } from './staff-workload.util';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePageLimit, sliceCursorPage } from '../common/pagination/cursor-page.util';
import { StaffRepository } from './staff.repository';
@Injectable()
export class StaffService {
  constructor(
    private readonly repo: StaffRepository,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => WorkflowEngineService))
    private readonly workflows: WorkflowEngineService,
    private readonly audit: AuditService,
    private readonly leave: LeaveService,
    private readonly appraisal: AppraisalService,
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

  private profileScopeEntityId(user: AuthUser, query?: ListStaffProfilesQueryDto) {
    const scope = query?.scope ?? 'entity';
    if (scope === 'institution') {
      return query?.entityId?.trim() || undefined;
    }
    return query?.entityId?.trim() || this.entityId(user);
  }

  async listProfiles(user: AuthUser, query?: ListStaffProfilesQueryDto) {
    const entityId = this.profileScopeEntityId(user, query);
    const limit = normalizePageLimit(query?.limit, 50, 100);
    const rows = await this.repo.listProfiles(user.institutionId, entityId, limit, query?.cursor);
    const { data, nextCursor } = sliceCursorPage(rows, limit);
    return {
      data: data.map((r) => this.mapProfile(r, user)),
      nextCursor,
      scope: query?.scope ?? (entityId ? 'entity' : 'institution'),
    };
  }

  async getProfile(user: AuthUser, id: string, query?: ListStaffProfilesQueryDto) {
    const entityId = this.profileScopeEntityId(user, query);
    const row = await this.repo.findProfile(user.institutionId, id, entityId);
    if (!row) throw new NotFoundException('Staff profile not found');
    return this.mapProfile(row, user);
  }

  async getMyProfile(user: AuthUser) {
    const row = await this.repo.findProfileByUserId(user.institutionId, user.userId);
    if (!row) throw new NotFoundException('No staff profile linked to your account');
    return this.mapProfile(row, user);
  }

  listUsersAvailableForProfile(user: AuthUser, query?: string) {
    return this.repo.listUsersWithoutStaffProfile(user.institutionId, query).then((rows) => ({
      data: rows.map((u) => {
        const profile = u.profile as Record<string, unknown> | null;
        const joined = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ');
        return {
          id: u.id,
          email: u.email,
          name:
            (profile?.displayName as string) ?? (profile?.name as string) ?? (joined || u.email),
        };
      }),
    }));
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
      qualifications: (dto.qualifications ?? []) as Prisma.InputJsonValue,
      publications: (dto.publications ?? []) as Prisma.InputJsonValue,
      ...(dto.salary
        ? {
            salary: encryptSalary({
              amount: dto.salary.amount,
              currency: dto.salary.currency ?? 'USD',
              effectiveDate: dto.salary.effectiveDate,
            }),
          }
        : {}),
    });
    this.audit.append({
      institutionId: user.institutionId,
      actorId: user.userId,
      action: 'staff.profile.created',
      entity: 'StaffProfile',
      entityId: row.id,
    });
    return this.mapProfile(row, user);
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
      ...(dto.qualifications !== undefined
        ? { qualifications: dto.qualifications as Prisma.InputJsonValue }
        : {}),
      ...(dto.publications !== undefined
        ? { publications: dto.publications as Prisma.InputJsonValue }
        : {}),
      ...(dto.salary
        ? {
            salary: encryptSalary({
              amount: dto.salary.amount,
              currency: dto.salary.currency ?? 'USD',
              effectiveDate: dto.salary.effectiveDate,
            }),
          }
        : {}),
    });
    const row = await this.repo.findProfile(user.institutionId, id, this.entityId(user));
    return this.mapProfile(row!, user);
  }

  async grantTeachingEntityAccess(user: AuthUser, staffId: string, dto: GrantStaffEntityAccessDto) {
    const profile = await this.repo.findProfile(user.institutionId, staffId, this.entityId(user));
    if (!profile) throw new NotFoundException('Staff profile not found');
    if (dto.entityId === profile.entityId) {
      throw new BadRequestException('Cannot grant access to the staff home campus');
    }
    const entity = await this.prisma.institutionEntity.findFirst({
      where: { id: dto.entityId, institutionId: user.institutionId, deletedAt: null },
    });
    if (!entity) throw new NotFoundException('Target entity not found');
    await this.prisma.userEntityAccess.upsert({
      where: { userId_entityId: { userId: profile.userId, entityId: dto.entityId } },
      create: { userId: profile.userId, entityId: dto.entityId },
      update: {},
    });
    return this.listEntityAccess(user, staffId);
  }

  async revokeTeachingEntityAccess(user: AuthUser, staffId: string, entityId: string) {
    const profile = await this.repo.findProfile(user.institutionId, staffId, this.entityId(user));
    if (!profile) throw new NotFoundException('Staff profile not found');
    const result = await this.prisma.userEntityAccess.deleteMany({
      where: { userId: profile.userId, entityId },
    });
    if (result.count === 0) throw new NotFoundException('Teaching access grant not found');
    return this.listEntityAccess(user, staffId);
  }

  async deleteProfile(user: AuthUser, id: string) {
    const row = await this.repo.findProfile(user.institutionId, id, this.entityId(user));
    if (!row) throw new NotFoundException('Staff profile not found');
    await this.repo.softDeleteProfile(user.institutionId, id);
    return { ok: true };
  }

  async listEntityAccess(user: AuthUser, staffId: string) {
    const profile = await this.repo.findProfile(user.institutionId, staffId, this.entityId(user));
    if (!profile) throw new NotFoundException('Staff profile not found');
    const rows = await this.prisma.userEntityAccess.findMany({
      where: { userId: profile.userId },
      include: { entity: { select: { id: true, code: true, name: true } } },
    });
    return {
      staffId,
      homeEntityId: profile.entityId,
      teachingEntities: rows.map((r) => r.entity),
    };
  }

  listLeaveTypes(user: AuthUser) {
    return this.leave.listLeaveTypes(user);
  }

  createLeaveType(user: AuthUser, dto: CreateLeaveTypeDto) {
    return this.leave.createLeaveType(user, dto);
  }

  listLeaveBalances(user: AuthUser, staffId?: string) {
    return this.leave.listLeaveBalances(user, staffId);
  }

  allocateLeaveBalance(user: AuthUser, dto: AllocateLeaveBalanceDto) {
    return this.leave.allocateLeaveBalance(user, dto);
  }

  carryForwardLeaveBalances(user: AuthUser, dto: CarryForwardLeaveDto) {
    return this.leave.carryForwardLeaveBalances(user, dto);
  }

  leaveCalendar(user: AuthUser, fromIso: string, toIso: string) {
    return this.leave.leaveCalendar(user, fromIso, toIso);
  }

  exportLeaveCalendarIcs(user: AuthUser, fromIso: string, toIso: string) {
    return this.leave.exportLeaveCalendarIcs(user, fromIso, toIso);
  }

  registerExternalCalendar(
    user: AuthUser,
    leaveRequestId: string,
    dto: RegisterExternalCalendarDto,
  ) {
    return this.leave.registerExternalCalendar(user, leaveRequestId, dto);
  }

  listLeaveRequests(user: AuthUser, staffId?: string) {
    return this.leave.listLeaveRequests(user, staffId);
  }

  createLeaveRequest(user: AuthUser, dto: CreateLeaveRequestDto) {
    return this.leave.createLeaveRequest(user, dto);
  }

  listAppraisals(user: AuthUser, staffId?: string) {
    return this.appraisal.listAppraisals(user, staffId);
  }

  createAppraisal(user: AuthUser, dto: Parameters<AppraisalService['createAppraisal']>[1]) {
    return this.appraisal.createAppraisal(user, dto);
  }

  createAppraisalCycle(
    user: AuthUser,
    dto: Parameters<AppraisalService['createAppraisalCycle']>[1],
  ) {
    return this.appraisal.createAppraisalCycle(user, dto);
  }

  addPeerFeedback(
    user: AuthUser,
    appraisalId: string,
    dto: Parameters<AppraisalService['addPeerFeedback']>[2],
  ) {
    return this.appraisal.addPeerFeedback(user, appraisalId, dto);
  }

  submitAppraisal(user: AuthUser, id: string) {
    return this.appraisal.submitAppraisal(user, id);
  }

  getKpiTemplate(user: AuthUser, positionId: string) {
    return this.appraisal.getKpiTemplate(user, positionId);
  }

  updateAppraisalReviewer(
    user: AuthUser,
    id: string,
    dto: Parameters<AppraisalService['updateAppraisalReviewer']>[2],
  ) {
    return this.appraisal.updateAppraisalReviewer(user, id, dto);
  }

  updateAppraisal(
    user: AuthUser,
    id: string,
    body: Parameters<AppraisalService['updateAppraisal']>[2],
  ) {
    return this.appraisal.updateAppraisal(user, id, body);
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

  async applyWorkloadSuggestions(user: AuthUser, dto: ApplyWorkloadSuggestionsDto) {
    const entityId = this.entityId(user);
    let applied = 0;
    const skipped: Array<{ staffId: string; reason: string }> = [];
    for (const row of dto.suggestions) {
      const staff = await this.repo.findProfile(user.institutionId, row.staffId, entityId);
      if (!staff) continue;
      const entity = await this.prisma.institutionEntity.findFirst({
        where: { id: staff.entityId, institutionId: user.institutionId },
        select: { settings: true },
      });
      const hrSettings = parseEntityHrSettings(entity?.settings);
      const maxHours = hrSettings.maxCreditHoursPerSemester ?? 18;
      if (hrSettings.blockWorkloadOverMax && row.suggestedCreditHours > maxHours) {
        skipped.push({
          staffId: row.staffId,
          reason: `Exceeds max ${maxHours} credit hours`,
        });
        continue;
      }
      await this.repo.upsertWorkload({
        institutionId: user.institutionId,
        entityId: staff.entityId,
        staffId: row.staffId,
        semesterId: dto.semesterId,
        assignedSections: [],
        totalCreditHours: row.suggestedCreditHours,
        maxCreditHours: maxHours,
        researchHours: 0,
        adminHours: 0,
      });
      applied += 1;
    }
    return { applied, skipped };
  }

  syncAppraisalStatusOnWorkflowStep(institutionId: string, appraisalId: string, newStep: number) {
    return this.appraisal.syncAppraisalStatusOnWorkflowStep(institutionId, appraisalId, newStep);
  }

  async getHrWorkflowInbox(user: AuthUser) {
    const rows = await this.prisma.workflowInstance.findMany({
      where: {
        institutionId: user.institutionId,
        currentAssigneeUserId: user.userId,
        status: { in: [WorkflowStatus.IN_PROGRESS, WorkflowStatus.ESCALATED] },
        definitionCode: { in: ['LEAVE_REQUEST', 'STAFF_APPRAISAL'] },
      },
      take: 30,
      orderBy: { dueAt: 'asc' },
      include: {
        definition: { select: { name: true, code: true } },
        entity: { select: { code: true, name: true } },
        initiator: { select: { email: true, profile: true } },
      },
    });
    return { data: rows };
  }

  async suggestWorkload(user: AuthUser, semesterId: string, totalHoursToAssign: number) {
    const listed = await this.listWorkload(user, semesterId);
    return {
      suggestions: suggestWorkloadDistribution(
        listed.data.map((w) => ({
          staffId: w.staffId,
          staffNumber: w.staff.staffNumber,
          totalCreditHours: w.totalCreditHours,
          maxCreditHours: w.maxCreditHours,
        })),
        totalHoursToAssign,
      ),
    };
  }

  async upsertWorkload(user: AuthUser, dto: UpsertWorkloadDto) {
    const staff = await this.repo.findProfile(user.institutionId, dto.staffId, this.entityId(user));
    if (!staff) throw new NotFoundException('Staff profile not found');
    const entity = await this.prisma.institutionEntity.findFirst({
      where: { id: staff.entityId, institutionId: user.institutionId },
      select: { settings: true },
    });
    const hrSettings = parseEntityHrSettings(entity?.settings);
    const maxHours = dto.maxCreditHours ?? hrSettings.maxCreditHoursPerSemester ?? 18;
    const total = dto.totalCreditHours ?? 0;
    if (hrSettings.blockWorkloadOverMax && total > maxHours) {
      throw new BadRequestException(`Credit hours (${total}) exceed entity maximum (${maxHours})`);
    }
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

  completeLeaveFromWorkflow(institutionId: string, leaveRequestId: string) {
    return this.leave.completeLeaveFromWorkflow(institutionId, leaveRequestId);
  }

  rejectLeaveFromWorkflow(institutionId: string, leaveRequestId: string) {
    return this.leave.rejectLeaveFromWorkflow(institutionId, leaveRequestId);
  }

  completeAppraisalFromWorkflow(institutionId: string, appraisalId: string) {
    return this.appraisal.completeAppraisalFromWorkflow(institutionId, appraisalId);
  }

  rejectAppraisalFromWorkflow(institutionId: string, appraisalId: string) {
    return this.appraisal.rejectAppraisalFromWorkflow(institutionId, appraisalId);
  }

  private mapProfile(
    row: NonNullable<Awaited<ReturnType<StaffRepository['findProfile']>>>,
    user?: AuthUser,
  ) {
    const profile = row.user.profile as Record<string, unknown> | null;
    const joined = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ');
    const name =
      (profile?.displayName as string) ?? (profile?.name as string) ?? (joined || row.user.email);
    const photoUrl =
      (profile?.avatarUrl as string) ??
      (profile?.photoUrl as string) ??
      (profile?.image as string) ??
      null;
    const canViewSalary =
      user?.permissions?.includes('*') || user?.permissions?.includes('staff.write');
    return {
      id: row.id,
      staffNumber: row.staffNumber,
      entityId: row.entityId,
      userId: row.userId,
      email: row.user.email,
      name,
      photoUrl,
      employmentType: row.employmentType,
      officeLocation: row.officeLocation,
      entity: row.entity,
      orgUnit: row.orgUnit,
      position: row.position,
      specializations: row.specializations,
      researchInterests: row.researchInterests,
      qualifications: row.qualifications,
      publications: row.publications,
      salary: canViewSalary ? decryptSalary(row.salary) : undefined,
    };
  }
}
