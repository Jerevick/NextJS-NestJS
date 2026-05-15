import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import type { CreateGradeOverrideDto } from './dto/create-grade-override.dto';
import type { CreateGradingScaleDto } from './dto/create-grading-scale.dto';
import type { ListGradeOverridesQueryDto } from './dto/list-grade-overrides-query.dto';
import type { UpdateEnrollmentGradeDto } from './dto/update-enrollment-grade.dto';
import type { UpdateGradingScaleDto } from './dto/update-grading-scale.dto';
import { parseGradeGovernance, userHasAnyPermission } from './grade-governance';
import { GradesRepository } from './grades.repository';

type ScaleBand = { min: number; max: number; letter: string; points: number };
type Workflow = 'DRAFT' | 'SUBMITTED' | 'APPROVED';

function asGradeObject(g: unknown): Record<string, unknown> {
  if (g && typeof g === 'object' && !Array.isArray(g)) {
    return { ...(g as Record<string, unknown>) };
  }
  return {};
}

function parseScaleBands(scale: unknown): ScaleBand[] {
  if (!Array.isArray(scale)) {
    return [];
  }
  const out: ScaleBand[] = [];
  for (const row of scale) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const r = row as Record<string, unknown>;
    const min = Number(r.min);
    const max = Number(r.max);
    const letter = r.letter;
    const points = Number(r.points);
    if (
      Number.isFinite(min) &&
      Number.isFinite(max) &&
      typeof letter === 'string' &&
      letter.length > 0 &&
      Number.isFinite(points)
    ) {
      out.push({ min, max, letter, points });
    }
  }
  return out;
}

function validateScaleBands(bands: ScaleBand[]) {
  if (bands.length === 0) {
    throw new BadRequestException('Grading scale must include at least one band');
  }
  for (const b of bands) {
    if (b.min > b.max) {
      throw new BadRequestException('Each scale band must have min <= max');
    }
  }
}

function mapScoreToLetterPoints(score: number, bands: ScaleBand[]): { letter: string; points: number } | null {
  for (const b of bands) {
    if (score >= b.min && score <= b.max) {
      return { letter: b.letter, points: b.points };
    }
  }
  return null;
}

function gradeJsonSummary(g: Record<string, unknown>): Prisma.InputJsonValue {
  return {
    workflowStatus: g.workflowStatus as Prisma.InputJsonValue,
    score: g.score as Prisma.InputJsonValue,
    letterGrade: g.letterGrade as Prisma.InputJsonValue,
    gradePoints: g.gradePoints as Prisma.InputJsonValue,
  };
}

@Injectable()
export class GradesService {
  constructor(
    private readonly repo: GradesRepository,
    private readonly audit: AuditService,
  ) {}

  private hasFullWrite(user: AuthUser) {
    return user.permissions.includes('*') || user.permissions.includes('grades.write');
  }

  private hasRead(user: AuthUser) {
    return (
      user.permissions.includes('*') ||
      user.permissions.includes('grades.read') ||
      user.permissions.includes('grades.write')
    );
  }

  private hasEnter(user: AuthUser) {
    return user.permissions.includes('*') || user.permissions.includes('grades.enter');
  }

  private isSectionInstructor(user: AuthUser, instructorId: string | null) {
    return instructorId !== null && instructorId === user.userId;
  }

  assertCanViewSectionGrades(user: AuthUser, section: { instructorId: string | null }) {
    if (this.hasFullWrite(user) || this.hasRead(user)) {
      return;
    }
    if (this.hasEnter(user) && this.isSectionInstructor(user, section.instructorId)) {
      return;
    }
    throw new ForbiddenException('Not allowed to view grades for this section');
  }

  private assertCanEditEnrollmentGrade(
    user: AuthUser,
    section: { instructorId: string | null },
    prevWorkflow: Workflow,
    governance: ReturnType<typeof parseGradeGovernance>,
  ) {
    if (prevWorkflow === 'APPROVED') {
      if (userHasAnyPermission(user, governance.postApprovalEditPermissionCodes)) {
        return;
      }
      throw new ForbiddenException(
        'This grade is approved. Only roles permitted by your institution may change it.',
      );
    }
    if (this.hasFullWrite(user)) {
      return;
    }
    if (this.hasEnter(user) && this.isSectionInstructor(user, section.instructorId)) {
      return;
    }
    throw new ForbiddenException('Not allowed to enter grades for this section');
  }

  private assertCanApproveFinal(user: AuthUser, governance: ReturnType<typeof parseGradeGovernance>) {
    if (!userHasAnyPermission(user, governance.approvePermissionCodes)) {
      throw new ForbiddenException(
        'Your account is not allowed to give final grade approval under this institution\'s policy.',
      );
    }
  }

  private assertCanReviewGradeOverrideQueue(user: AuthUser, governance: ReturnType<typeof parseGradeGovernance>) {
    if (this.hasFullWrite(user)) {
      return;
    }
    const codes = [
      ...governance.approvePermissionCodes,
      ...governance.postApprovalEditPermissionCodes,
    ];
    if (userHasAnyPermission(user, [...new Set(codes)])) {
      return;
    }
    throw new ForbiddenException('Not allowed to review grade change requests for this institution');
  }

  private assertCanRequestGradeOverride(
    user: AuthUser,
    section: { instructorId: string | null },
    governance: ReturnType<typeof parseGradeGovernance>,
  ) {
    if (this.hasFullWrite(user)) {
      return;
    }
    if (userHasAnyPermission(user, governance.postApprovalEditPermissionCodes)) {
      return;
    }
    if (this.hasEnter(user) && this.isSectionInstructor(user, section.instructorId)) {
      return;
    }
    throw new ForbiddenException('Not allowed to request a grade change for this enrollment');
  }

  async listSectionEnrollments(actor: AuthUser, sectionId: string) {
    const section = await this.repo.findSection(actor.institutionId, sectionId);
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    this.assertCanViewSectionGrades(actor, section);
    const rows = await this.repo.findEnrollmentsForSection(actor.institutionId, sectionId);
    return rows.map((r) => this.serializeEnrollmentRow(r));
  }

  async updateEnrollmentGrade(actor: AuthUser, enrollmentId: string, dto: UpdateEnrollmentGradeDto) {
    const row = await this.repo.findEnrollmentWithSection(actor.institutionId, enrollmentId);
    if (!row) {
      throw new NotFoundException('Enrollment not found');
    }
    const inst = await this.repo.getInstitutionSettings(actor.institutionId);
    const governance = parseGradeGovernance(inst?.settings);

    const prev = asGradeObject(row.grade);
    const prevWorkflow = (prev.workflowStatus as Workflow | undefined) ?? 'DRAFT';

    this.assertCanEditEnrollmentGrade(actor, row.section, prevWorkflow, governance);

    if (dto.workflowStatus === 'APPROVED') {
      this.assertCanApproveFinal(actor, governance);
    }

    if (
      dto.workflowStatus === 'SUBMITTED' &&
      prevWorkflow === 'APPROVED' &&
      !userHasAnyPermission(actor, governance.postApprovalEditPermissionCodes)
    ) {
      throw new BadRequestException('Cannot move an approved grade back to submitted without authorization');
    }

    const next: Record<string, unknown> = { ...prev, lastUpdatedBy: actor.userId, updatedAt: new Date().toISOString() };

    if (dto.components !== undefined) {
      next.components = dto.components;
    }
    if (dto.score !== undefined) {
      next.score = dto.score;
    }
    if (dto.letterGrade !== undefined) {
      next.letterGrade = dto.letterGrade;
    }
    if (dto.gradePoints !== undefined) {
      next.gradePoints = dto.gradePoints;
    }
    if (dto.workflowStatus !== undefined) {
      next.workflowStatus = dto.workflowStatus;
    }

    const scale = await this.resolveDefaultScale(actor.institutionId);
    const bands = parseScaleBands(scale?.scale);
    if (dto.score !== undefined && dto.letterGrade === undefined && dto.gradePoints === undefined && bands.length) {
      const mapped = mapScoreToLetterPoints(dto.score, bands);
      if (mapped) {
        next.letterGrade = mapped.letter;
        next.gradePoints = mapped.points;
      }
    }

    const updated = await this.repo.updateEnrollmentGrade(row.id, next as Prisma.InputJsonValue);
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'enrollment_grade.update',
      entity: 'StudentEnrollment',
      entityId: row.id,
      oldValues: gradeJsonSummary(prev),
      newValues: gradeJsonSummary(next),
    });
    return this.serializeEnrollmentRow(updated);
  }

  private async resolveDefaultScale(institutionId: string) {
    return (
      (await this.repo.findDefaultGradingScale(institutionId)) ??
      (await this.repo.findFirstGradingScale(institutionId))
    );
  }

  async getEffectiveGradeGovernance(actor: AuthUser) {
    const inst = await this.repo.getInstitutionSettings(actor.institutionId);
    return parseGradeGovernance(inst?.settings);
  }

  async createGradeOverrideRequest(actor: AuthUser, enrollmentId: string, dto: CreateGradeOverrideDto) {
    const row = await this.repo.findEnrollmentWithSection(actor.institutionId, enrollmentId);
    if (!row) {
      throw new NotFoundException('Enrollment not found');
    }
    const inst = await this.repo.getInstitutionSettings(actor.institutionId);
    const governance = parseGradeGovernance(inst?.settings);

    this.assertCanViewSectionGrades(actor, row.section);
    this.assertCanRequestGradeOverride(actor, row.section, governance);

    const prev = asGradeObject(row.grade);
    const prevWorkflow = (prev.workflowStatus as Workflow | undefined) ?? 'DRAFT';
    if (prevWorkflow !== 'APPROVED') {
      throw new BadRequestException(
        'Grade change requests apply only after a grade is finally approved. Use direct grade entry until then.',
      );
    }

    if (!dto.newGrade || typeof dto.newGrade !== 'object' || Array.isArray(dto.newGrade)) {
      throw new BadRequestException('newGrade must be a non-array object');
    }

    const oldGradeSnapshot =
      row.grade === null || row.grade === undefined ? Prisma.JsonNull : (row.grade as Prisma.InputJsonValue);

    const created = await this.repo.createGradeOverride({
      institutionId: actor.institutionId,
      enrollmentId: row.id,
      requestedById: actor.userId,
      reason: dto.reason.trim(),
      oldGrade: oldGradeSnapshot,
      newGrade: dto.newGrade as Prisma.InputJsonValue,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'grade_override.request',
      entity: 'GradeOverride',
      entityId: created.id,
      newValues: { enrollmentId: row.id, reason: dto.reason.trim() },
    });
    return this.serializeGradeOverride(created);
  }

  async listPendingGradeOverrides(actor: AuthUser, query: ListGradeOverridesQueryDto) {
    const inst = await this.repo.getInstitutionSettings(actor.institutionId);
    const governance = parseGradeGovernance(inst?.settings);
    this.assertCanReviewGradeOverrideQueue(actor, governance);

    const limit = query.limit ?? 50;
    const rows = await this.repo.findPendingOverridesPage(actor.institutionId, limit, query.cursor);
    let nextCursor: string | undefined;
    if (rows.length > limit) {
      const last = rows.pop();
      nextCursor = last?.id;
    }
    const total = await this.repo.countPendingOverrides(actor.institutionId);
    return {
      data: rows.map((r) => this.serializeGradeOverride(r)),
      nextCursor,
      total,
    };
  }

  async approveGradeOverride(actor: AuthUser, overrideId: string) {
    const inst = await this.repo.getInstitutionSettings(actor.institutionId);
    const governance = parseGradeGovernance(inst?.settings);
    this.assertCanReviewGradeOverrideQueue(actor, governance);

    const o = await this.repo.findPendingOverride(actor.institutionId, overrideId);
    if (!o) {
      throw new NotFoundException('Pending grade change request not found');
    }

    const proposed = asGradeObject(o.newGrade);
    const applied: Record<string, unknown> = {
      ...proposed,
      workflowStatus: 'APPROVED',
      lastUpdatedBy: actor.userId,
      updatedAt: new Date().toISOString(),
    };

    const refreshed = await this.repo.approveGradeOverrideAndApplyEnrollment({
      overrideId: o.id,
      approvedById: actor.userId,
      enrollmentId: o.enrollmentId,
      grade: applied as Prisma.InputJsonValue,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'grade_override.approve',
      entity: 'GradeOverride',
      entityId: o.id,
      newValues: { enrollmentId: o.enrollmentId },
    });
    return this.serializeGradeOverride(refreshed!);
  }

  async rejectGradeOverride(actor: AuthUser, overrideId: string) {
    const inst = await this.repo.getInstitutionSettings(actor.institutionId);
    const governance = parseGradeGovernance(inst?.settings);
    this.assertCanReviewGradeOverrideQueue(actor, governance);

    const o = await this.repo.findPendingOverride(actor.institutionId, overrideId);
    if (!o) {
      throw new NotFoundException('Pending grade change request not found');
    }

    const n = await this.repo.softDeleteGradeOverride(actor.institutionId, overrideId, new Date());
    if (n.count === 0) {
      throw new NotFoundException('Pending grade change request not found');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'grade_override.reject',
      entity: 'GradeOverride',
      entityId: overrideId,
      oldValues: { enrollmentId: o.enrollmentId },
      newValues: { rejected: true },
    });
    return { ok: true as const, id: overrideId };
  }

  async listGradingScales(actor: AuthUser) {
    const rows = await this.repo.listGradingScales(actor.institutionId);
    return rows.map((s) => this.serializeScale(s));
  }

  async createGradingScale(actor: AuthUser, dto: CreateGradingScaleDto) {
    const bands = dto.scale.map((b) => ({ min: b.min, max: b.max, letter: b.letter, points: b.points }));
    validateScaleBands(bands);
    const isDefault = dto.isDefault === true;
    const created = await this.repo.createGradingScale({
      institutionId: actor.institutionId,
      name: dto.name,
      isDefault: false,
      scale: bands as unknown as Prisma.InputJsonValue,
    });
    if (isDefault) {
      await this.repo.clearDefaultFlagsExcept(actor.institutionId, created.id);
      await this.repo.setDefault(created.id);
    }
    const refreshed = await this.repo.findGradingScale(actor.institutionId, created.id);
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'grading_scale.create',
      entity: 'GradingScale',
      entityId: refreshed!.id,
      newValues: { name: refreshed!.name, isDefault: refreshed!.isDefault },
    });
    return this.serializeScale(refreshed!);
  }

  async updateGradingScale(actor: AuthUser, id: string, dto: UpdateGradingScaleDto) {
    const existing = await this.repo.findGradingScale(actor.institutionId, id);
    if (!existing) {
      throw new NotFoundException('Grading scale not found');
    }
    const data: Prisma.GradingScaleUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name;
    }
    if (dto.scale !== undefined) {
      const bands = dto.scale.map((b) => ({ min: b.min, max: b.max, letter: b.letter, points: b.points }));
      validateScaleBands(bands);
      data.scale = bands as unknown as Prisma.InputJsonValue;
    }
    if (dto.isDefault === true) {
      await this.repo.clearDefaultFlagsExcept(actor.institutionId, id);
      data.isDefault = true;
    } else if (dto.isDefault === false) {
      data.isDefault = false;
    }
    await this.repo.updateGradingScale(id, data);
    const refreshed = await this.repo.findGradingScale(actor.institutionId, id);
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'grading_scale.update',
      entity: 'GradingScale',
      entityId: id,
      oldValues: { name: existing.name, isDefault: existing.isDefault },
      newValues: { name: refreshed!.name, isDefault: refreshed!.isDefault },
    });
    return this.serializeScale(refreshed!);
  }

  async removeGradingScale(actor: AuthUser, id: string) {
    const existing = await this.repo.findGradingScale(actor.institutionId, id);
    if (!existing) {
      throw new NotFoundException('Grading scale not found');
    }
    const n = await this.repo.softDeleteGradingScale(actor.institutionId, id, new Date());
    if (n.count === 0) {
      throw new NotFoundException('Grading scale not found');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'grading_scale.delete',
      entity: 'GradingScale',
      entityId: id,
      oldValues: { name: existing.name, isDefault: existing.isDefault },
      newValues: { softDeleted: true },
    });
    return { ok: true as const, id };
  }

  private serializeScale(s: {
    id: string;
    name: string;
    isDefault: boolean;
    scale: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: s.id,
      name: s.name,
      isDefault: s.isDefault,
      scale: s.scale,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }

  private serializeEnrollmentRow(
    r: Awaited<ReturnType<GradesRepository['findEnrollmentsForSection']>>[number],
  ) {
    return {
      id: r.id,
      status: r.status,
      grade: r.grade,
      enrolledAt: r.enrolledAt,
      student: r.student,
      section: r.section,
    };
  }

  private serializeGradeOverride(
    r: Awaited<ReturnType<GradesRepository['createGradeOverride']>> & {
      approver?: { id: string; email: string } | null;
    },
  ) {
    return {
      id: r.id,
      enrollmentId: r.enrollmentId,
      reason: r.reason,
      oldGrade: r.oldGrade,
      newGrade: r.newGrade,
      approvedById: r.approvedById,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      requester: r.requester,
      approver: 'approver' in r ? r.approver : undefined,
      enrollment: r.enrollment,
    };
  }
}
