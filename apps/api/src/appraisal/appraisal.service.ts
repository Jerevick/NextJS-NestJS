import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { AppraisalStatus, Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import type { AddPeerFeedbackDto } from '../staff/dto/add-peer-feedback.dto';
import type { CreateAppraisalCycleDto } from '../staff/dto/create-appraisal-cycle.dto';
import type { CreateStaffAppraisalDto } from '../staff/dto/create-appraisal.dto';
import type { UpdateAppraisalReviewerDto } from '../staff/dto/update-appraisal-reviewer.dto';
import { StaffRepository } from '../staff/staff.repository';
import { resolveImmediateHeadUserId } from './appraisal-head.resolve';
import { resolveRoleExpectationsFromHr, type RoleExpectations } from './appraisal-head.util';
import { AppraisalRepository } from './appraisal.repository';
import type { UpsertKpiTemplateDto } from './dto/upsert-kpi-template.dto';
import type { UpsertRoleExpectationsDto } from './dto/upsert-role-expectations.dto';

type KpiTemplateItem = { key: string; label: string; weight?: number };

@Injectable()
export class AppraisalService {
  constructor(
    private readonly repo: AppraisalRepository,
    private readonly staffRepo: StaffRepository,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => WorkflowEngineService))
    private readonly workflows: WorkflowEngineService,
    private readonly audit: AuditService,
  ) {}

  private entityId(user: AuthUser) {
    if (!user.entityId) {
      throw new BadRequestException('X-Entity-ID header is required for appraisal operations');
    }
    return user.entityId;
  }

  private async loadHrSettings(institutionId: string) {
    const inst = await this.prisma.institution.findFirst({
      where: { id: institutionId },
      select: { settings: true },
    });
    return this.readHrSettings(inst?.settings);
  }

  private async resolveImmediateHeadForStaff(
    staff: {
      institutionId: string;
      entityId: string;
      orgUnitId: string;
      userId: string;
      position: { level: number };
    },
    explicitReviewerId?: string,
  ): Promise<string | undefined> {
    if (explicitReviewerId?.trim()) return explicitReviewerId.trim();
    const hr = await this.loadHrSettings(staff.institutionId);
    return resolveImmediateHeadUserId(this.prisma, {
      institutionId: staff.institutionId,
      entityId: staff.entityId,
      orgUnitId: staff.orgUnitId,
      staffUserId: staff.userId,
      staffPositionLevel: staff.position.level,
      hrSettings: hr,
    });
  }

  private async canSubmitReviewerAssessment(
    user: AuthUser,
    row: {
      reviewerId: string | null;
      workflowInstanceId: string | null;
    },
  ): Promise<boolean> {
    if (user.permissions?.includes('*') || user.permissions?.includes('staff.write')) {
      return true;
    }
    if (row.reviewerId === user.userId) return true;
    if (row.workflowInstanceId) {
      const wf = await this.prisma.workflowInstance.findFirst({
        where: { id: row.workflowInstanceId, institutionId: user.institutionId },
        select: { currentAssigneeUserId: true },
      });
      if (wf?.currentAssigneeUserId === user.userId) return true;
    }
    return false;
  }

  private readHrSettings(settings: unknown): Record<string, unknown> {
    const root =
      settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : {};
    const hr = root.hr;
    return hr && typeof hr === 'object' ? (hr as Record<string, unknown>) : {};
  }

  async listAppraisals(user: AuthUser, staffId?: string) {
    const rows = await this.repo.listAppraisals(user.institutionId, this.entityId(user), staffId);
    const workflowIds = rows
      .map((r) => r.workflowInstanceId)
      .filter((id): id is string => Boolean(id));
    const workflows =
      workflowIds.length > 0
        ? await this.prisma.workflowInstance.findMany({
            where: { id: { in: workflowIds }, institutionId: user.institutionId },
            select: {
              id: true,
              currentStep: true,
              currentStepName: true,
              status: true,
            },
          })
        : [];
    const workflowById = new Map(workflows.map((w) => [w.id, w]));
    return {
      data: rows.map((row) => ({
        ...this.enrichAppraisalRow(row),
        workflowInstance: row.workflowInstanceId
          ? (workflowById.get(row.workflowInstanceId) ?? null)
          : null,
      })),
    };
  }

  async getAppraisal(user: AuthUser, id: string) {
    const row = await this.repo.findAppraisal(user.institutionId, id);
    if (!row || row.entityId !== this.entityId(user)) {
      throw new NotFoundException('Appraisal not found');
    }
    return this.enrichAppraisalRow(row);
  }

  async getStaffRoleProfile(user: AuthUser, staffId: string) {
    const staff = await this.staffRepo.findProfile(
      user.institutionId,
      staffId,
      this.entityId(user),
    );
    if (!staff) throw new NotFoundException('Staff profile not found');
    const hr = await this.loadHrSettings(user.institutionId);
    const roleExpectations = resolveRoleExpectationsFromHr(
      hr,
      staff.position.code,
      staff.position.level,
    );
    roleExpectations.positionCode = staff.position.code;
    roleExpectations.positionTitle = staff.position.title;
    const immediateHeadUserId = await this.resolveImmediateHeadForStaff({
      institutionId: staff.institutionId,
      entityId: staff.entityId,
      orgUnitId: staff.orgUnitId,
      userId: staff.userId,
      position: staff.position,
    });
    let immediateHead: { userId: string; email: string; name: string } | null = null;
    if (immediateHeadUserId) {
      const headUser = await this.prisma.user.findFirst({
        where: { id: immediateHeadUserId, institutionId: user.institutionId },
        select: { id: true, email: true, profile: true },
      });
      if (headUser) {
        const profile = headUser.profile as Record<string, unknown> | null;
        const joined = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ');
        const name =
          ((profile?.displayName as string) ?? (profile?.name as string) ?? joined) ||
          headUser.email;
        immediateHead = { userId: headUser.id, email: headUser.email, name };
      }
    }
    const template = this.resolveKpiTemplate(hr, staff.position.code, staff.position.level);
    return {
      staffId: staff.id,
      staffNumber: staff.staffNumber,
      position: staff.position,
      roleExpectations,
      kpiTemplate: template,
      immediateHead,
    };
  }

  private enrichAppraisalRow<T extends Record<string, unknown>>(row: T) {
    const raw = row.roleExpectations;
    const stored = raw && typeof raw === 'object' ? (raw as RoleExpectations) : null;
    return { ...row, roleExpectations: stored };
  }

  async createAppraisal(user: AuthUser, dto: CreateStaffAppraisalDto) {
    const staff = await this.staffRepo.findProfile(
      user.institutionId,
      dto.staffId,
      this.entityId(user),
    );
    if (!staff) throw new NotFoundException('Staff profile not found');
    const hr = await this.loadHrSettings(user.institutionId);
    const roleExpectations = resolveRoleExpectationsFromHr(
      hr,
      staff.position.code,
      staff.position.level,
    );
    roleExpectations.positionCode = staff.position.code;
    roleExpectations.positionTitle = staff.position.title;
    const reviewerId = await this.resolveImmediateHeadForStaff(
      {
        institutionId: staff.institutionId,
        entityId: staff.entityId,
        orgUnitId: staff.orgUnitId,
        userId: staff.userId,
        position: staff.position,
      },
      dto.reviewerId,
    );
    return this.repo.createAppraisalDraft({
      institutionId: user.institutionId,
      entityId: staff.entityId,
      staffId: dto.staffId,
      reviewerId,
      periodStart: new Date(dto.periodStart),
      periodEnd: new Date(dto.periodEnd),
      type: dto.type,
      roleExpectations: roleExpectations as unknown as Prisma.InputJsonValue,
    });
  }

  async createAppraisalCycle(user: AuthUser, dto: CreateAppraisalCycleDto) {
    const entityId = this.entityId(user);
    const profiles = dto.staffIds?.length
      ? (
          await Promise.all(
            dto.staffIds.map((id) => this.staffRepo.findProfile(user.institutionId, id, entityId)),
          )
        ).filter(Boolean)
      : await this.staffRepo.listProfiles(user.institutionId, entityId, 500);
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    const created: string[] = [];
    const hr = await this.loadHrSettings(user.institutionId);
    for (const profile of profiles) {
      if (!profile) continue;
      const roleExpectations = resolveRoleExpectationsFromHr(
        hr,
        profile.position.code,
        profile.position.level,
      );
      roleExpectations.positionCode = profile.position.code;
      roleExpectations.positionTitle = profile.position.title;
      const reviewerId = await this.resolveImmediateHeadForStaff({
        institutionId: profile.institutionId,
        entityId: profile.entityId,
        orgUnitId: profile.orgUnitId,
        userId: profile.userId,
        position: profile.position,
      });
      const row = await this.repo.createAppraisalDraft({
        institutionId: user.institutionId,
        entityId: profile.entityId,
        staffId: profile.id,
        reviewerId,
        periodStart,
        periodEnd,
        type: dto.type,
        roleExpectations: roleExpectations as unknown as Prisma.InputJsonValue,
      });
      created.push(row.id);
    }
    return { created: created.length, appraisalIds: created };
  }

  async addPeerFeedback(user: AuthUser, appraisalId: string, dto: AddPeerFeedbackDto) {
    const row = await this.repo.findAppraisal(user.institutionId, appraisalId);
    if (!row) throw new NotFoundException('Appraisal not found');
    if (row.type !== 'THREE_SIXTY') {
      throw new BadRequestException('Peer feedback is only used for THREE_SIXTY appraisals');
    }
    const isSubject = row.staff.userId === user.userId;
    const isPeer = dto.peerUserId === user.userId;
    const isHr = user.permissions?.includes('staff.write') || user.permissions?.includes('*');
    if (!isSubject && !isPeer && !isHr) {
      throw new ForbiddenException('Cannot add peer feedback to this appraisal');
    }
    const existing = Array.isArray(row.peerFeedback)
      ? (row.peerFeedback as Array<Record<string, unknown>>)
      : [];
    const entry = {
      peerUserId: dto.peerUserId,
      rating: dto.rating ?? null,
      comment: dto.comment?.trim() ?? '',
      submittedAt: new Date().toISOString(),
      submittedBy: user.userId,
    };
    await this.repo.updateAppraisal(user.institutionId, appraisalId, {
      peerFeedback: [...existing, entry] as Prisma.InputJsonValue,
    });
    return this.repo.findAppraisal(user.institutionId, appraisalId);
  }

  async submitAppraisal(user: AuthUser, id: string) {
    const row = await this.repo.findAppraisal(user.institutionId, id);
    if (!row) throw new NotFoundException('Appraisal not found');
    if (row.staff.userId !== user.userId && !user.permissions?.includes('staff.write')) {
      throw new ForbiddenException('Cannot submit this appraisal');
    }
    if (row.workflowInstanceId) {
      throw new BadRequestException('Appraisal workflow already started');
    }
    if (!row.selfAssessment?.trim()) {
      throw new BadRequestException('Self-assessment is required before submission');
    }
    if (row.type === 'THREE_SIXTY') {
      const peers = Array.isArray(row.peerFeedback) ? row.peerFeedback : [];
      if (peers.length < 2) {
        throw new BadRequestException(
          '360° appraisals require at least two peer feedback entries before submission',
        );
      }
    }
    const prepared = await this.workflows.prepareInitiation({
      institutionId: user.institutionId,
      entityId: row.entityId,
      definitionCode: 'STAFF_APPRAISAL',
      entityType: 'StaffAppraisal',
      initiatedBy: user.userId,
      entityId_record: row.id,
      metadata: { staffId: row.staffId },
    });
    const { appraisal } = await this.repo.submitAppraisalWithWorkflow(row.id, prepared);
    this.audit.append({
      institutionId: user.institutionId,
      actorId: user.userId,
      action: 'workflow.initiated',
      entity: 'StaffAppraisal',
      entityId: row.id,
      newValues: { definitionCode: 'STAFF_APPRAISAL' } as Prisma.InputJsonValue,
    });
    return appraisal;
  }

  async getKpiTemplate(user: AuthUser, positionId: string) {
    const position = await this.prisma.position.findFirst({
      where: { id: positionId, institutionId: user.institutionId, deletedAt: null },
      select: { id: true, code: true, level: true, title: true },
    });
    if (!position) throw new NotFoundException('Position not found');
    const inst = await this.prisma.institution.findFirst({
      where: { id: user.institutionId },
      select: { settings: true },
    });
    const hr = this.readHrSettings(inst?.settings);
    const template = this.resolveKpiTemplate(hr, position.code, position.level);
    const roleExpectations = resolveRoleExpectationsFromHr(hr, position.code, position.level);
    return {
      positionCode: position.code,
      positionLevel: position.level,
      positionTitle: position.title,
      template,
      duties: roleExpectations.duties,
      responsibilities: roleExpectations.responsibilities,
    };
  }

  async upsertRoleExpectations(user: AuthUser, dto: UpsertRoleExpectationsDto) {
    if (!dto.positionCode && dto.positionLevel === undefined) {
      throw new BadRequestException('Provide positionCode or positionLevel');
    }
    if (dto.positionCode && dto.positionLevel !== undefined) {
      throw new BadRequestException('Provide only one of positionCode or positionLevel');
    }
    const inst = await this.prisma.institution.findFirst({
      where: { id: user.institutionId },
      select: { settings: true },
    });
    if (!inst) throw new NotFoundException('Institution not found');
    const root =
      inst.settings && typeof inst.settings === 'object'
        ? { ...(inst.settings as Record<string, unknown>) }
        : {};
    const hr = this.readHrSettings(root);
    const payload: RoleExpectations = {
      duties: dto.duties.map((d) => d.trim()).filter(Boolean),
      responsibilities: dto.responsibilities.map((r) => r.trim()).filter(Boolean),
    };
    if (dto.positionCode) {
      const byCode = { ...(hr.roleExpectationsByPositionCode as Record<string, unknown>) };
      byCode[dto.positionCode.trim().toUpperCase()] = payload;
      hr.roleExpectationsByPositionCode = byCode;
    } else {
      const byLevel = { ...(hr.roleExpectationsByPositionLevel as Record<string, unknown>) };
      byLevel[String(dto.positionLevel)] = payload;
      hr.roleExpectationsByPositionLevel = byLevel;
    }
    root.hr = hr;
    await this.prisma.institution.update({
      where: { id: user.institutionId },
      data: { settings: root as Prisma.InputJsonValue },
    });
    return {
      positionCode: dto.positionCode ?? null,
      positionLevel: dto.positionLevel ?? null,
      ...payload,
    };
  }

  async upsertKpiTemplate(user: AuthUser, dto: UpsertKpiTemplateDto) {
    if (!dto.positionCode && dto.positionLevel === undefined) {
      throw new BadRequestException('Provide positionCode or positionLevel');
    }
    if (dto.positionCode && dto.positionLevel !== undefined) {
      throw new BadRequestException('Provide only one of positionCode or positionLevel');
    }
    const inst = await this.prisma.institution.findFirst({
      where: { id: user.institutionId },
      select: { settings: true },
    });
    if (!inst) throw new NotFoundException('Institution not found');
    const root =
      inst.settings && typeof inst.settings === 'object'
        ? { ...(inst.settings as Record<string, unknown>) }
        : {};
    const hr = this.readHrSettings(root);
    const template = dto.template.map((t) => ({
      key: t.key.trim(),
      label: t.label.trim(),
      ...(t.weight !== undefined ? { weight: t.weight } : {}),
    }));
    if (dto.positionCode) {
      const byCode = { ...(hr.kpiByPositionCode as Record<string, unknown>) };
      byCode[dto.positionCode.trim().toUpperCase()] = template;
      hr.kpiByPositionCode = byCode;
    } else {
      const byLevel = { ...(hr.kpiByPositionLevel as Record<string, unknown>) };
      byLevel[String(dto.positionLevel)] = template;
      hr.kpiByPositionLevel = byLevel;
    }
    root.hr = hr;
    await this.prisma.institution.update({
      where: { id: user.institutionId },
      data: { settings: root as Prisma.InputJsonValue },
    });
    return {
      positionCode: dto.positionCode ?? null,
      positionLevel: dto.positionLevel ?? null,
      template,
    };
  }

  private resolveKpiTemplate(
    hr: Record<string, unknown>,
    positionCode: string,
    positionLevel: number,
  ): KpiTemplateItem[] {
    const byPosition = (hr.kpiByPositionCode as Record<string, unknown>) ?? {};
    const byLevel = (hr.kpiByPositionLevel as Record<string, unknown>) ?? {};
    return (
      (byPosition[positionCode] as KpiTemplateItem[]) ??
      (byLevel[String(positionLevel)] as KpiTemplateItem[]) ??
      (hr.defaultKpi as KpiTemplateItem[]) ?? [
        { key: 'teaching', label: 'Teaching effectiveness', weight: 0.4 },
        { key: 'research', label: 'Research output', weight: 0.3 },
        { key: 'service', label: 'Institutional service', weight: 0.3 },
      ]
    );
  }

  async updateAppraisalReviewer(user: AuthUser, id: string, dto: UpdateAppraisalReviewerDto) {
    const row = await this.repo.findAppraisal(user.institutionId, id);
    if (!row) throw new NotFoundException('Appraisal not found');
    if (!(await this.canSubmitReviewerAssessment(user, row))) {
      throw new ForbiddenException(
        'Requires immediate head, current workflow assignee, or staff.write',
      );
    }
    await this.repo.updateAppraisal(user.institutionId, id, {
      reviewerComments: dto.reviewerComments,
      overallRating: dto.overallRating,
      kpiScores: dto.kpiScores as Prisma.InputJsonValue,
      status:
        row.status === AppraisalStatus.PENDING_REVIEW
          ? AppraisalStatus.PENDING_ENDORSEMENT
          : undefined,
    });
    return this.repo.findAppraisal(user.institutionId, id);
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

  async syncAppraisalStatusOnWorkflowStep(
    institutionId: string,
    appraisalId: string,
    newStep: number,
  ) {
    const status =
      newStep >= 2 ? AppraisalStatus.PENDING_ENDORSEMENT : AppraisalStatus.PENDING_REVIEW;
    await this.repo.updateAppraisal(institutionId, appraisalId, { status });
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
}
