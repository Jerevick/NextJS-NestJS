import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ReactivationRequestStatus, StudentEnrollmentStatusEnum } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateReactivationRequestDto } from './dto/create-reactivation-request.dto';
import type { ListReactivationRequestsQueryDto } from './dto/list-reactivation-requests-query.dto';
import type { ReviewReactivationRequestDto } from './dto/review-reactivation-request.dto';
import { StatusChangeService } from './status/status-change.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';

@Injectable()
export class ReactivationRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly statusChanges: StatusChangeService,
    private readonly workflows: WorkflowEngineService,
  ) {}

  private scopeEntityId(actor: AuthUser): string | undefined {
    return actor.entityScope === 'ALL' ? undefined : actor.entityId;
  }

  private assertReactivatePermission(actor: AuthUser): void {
    if (actor.permissions.includes('*') || actor.permissions.includes('students.reactivate')) {
      return;
    }
    throw new ForbiddenException('Missing permission to review student reactivation');
  }

  private async loadStudentForActor(actor: AuthUser, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId: actor.institutionId, deletedAt: null },
      select: { id: true, entityId: true, studentNumber: true, enrollmentStatus: true },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (actor.entityScope === 'ENTITY' && student.entityId !== actor.entityId) {
      throw new ForbiddenException('Student is outside your campus entity scope');
    }
    return student;
  }

  private async loadRequest(actor: AuthUser, id: string) {
    const scope = this.scopeEntityId(actor);
    const row = await this.prisma.reactivationRequest.findFirst({
      where: {
        id,
        institutionId: actor.institutionId,
        ...(scope ? { entityId: scope } : {}),
      },
      include: {
        student: {
          select: {
            id: true,
            studentNumber: true,
            enrollmentStatus: true,
            entityId: true,
          },
        },
        entity: { select: { id: true, code: true, name: true } },
      },
    });
    if (!row) {
      throw new NotFoundException('Reactivation request not found');
    }
    return row;
  }

  async create(actor: AuthUser, dto: CreateReactivationRequestDto): Promise<{ id: string }> {
    const student = await this.loadStudentForActor(actor, dto.studentId.trim());
    if (student.enrollmentStatus === StudentEnrollmentStatusEnum.ACTIVE) {
      throw new BadRequestException('Student is already ACTIVE');
    }

    const pending = await this.prisma.reactivationRequest.findFirst({
      where: {
        institutionId: actor.institutionId,
        studentId: student.id,
        status: ReactivationRequestStatus.PENDING,
      },
      select: { id: true },
    });
    if (pending) {
      throw new ConflictException('A pending reactivation request already exists for this student');
    }

    const created = await this.prisma.reactivationRequest.create({
      data: {
        institutionId: actor.institutionId,
        entityId: student.entityId,
        studentId: student.id,
        requestedBy: actor.userId,
        justification: dto.justification.trim(),
        status: ReactivationRequestStatus.PENDING,
      },
      select: { id: true },
    });

    const workflow = await this.workflows.initiateWorkflow({
      institutionId: actor.institutionId,
      entityId: student.entityId,
      definitionCode: 'STUDENT_REACTIVATION',
      entityType: 'ReactivationRequest',
      entityId_record: created.id,
      initiatedBy: actor.userId,
      metadata: {
        studentId: student.id,
        reviewNotes: dto.justification.trim(),
      },
    });

    await this.prisma.reactivationRequest.update({
      where: { id: created.id },
      data: { workflowInstanceId: workflow.id },
    });

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'student.reactivation.requested',
      entity: 'ReactivationRequest',
      entityId: created.id,
      newValues: {
        studentId: student.id,
        studentNumber: student.studentNumber,
        entityId: student.entityId,
        billingImplication: 'GAIN',
      } as Prisma.InputJsonValue,
    });

    return created;
  }

  async list(actor: AuthUser, query: ListReactivationRequestsQueryDto) {
    const take = Math.min(query.limit ?? 20, 100);
    const scope = this.scopeEntityId(actor);
    const where: Prisma.ReactivationRequestWhereInput = {
      institutionId: actor.institutionId,
      ...(scope ? { entityId: scope } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.studentId?.trim() ? { studentId: query.studentId.trim() } : {}),
    };
    const rows = await this.prisma.reactivationRequest.findMany({
      where,
      take: take + 1,
      ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        studentId: true,
        entityId: true,
        status: true,
        justification: true,
        createdAt: true,
        reviewedAt: true,
        student: { select: { studentNumber: true, enrollmentStatus: true } },
        entity: { select: { code: true, name: true } },
      },
    });
    let nextCursor: string | null = null;
    const data = rows.length > take ? rows.slice(0, take) : rows;
    if (rows.length > take) {
      nextCursor = data[data.length - 1]?.id ?? null;
    }
    const total = await this.prisma.reactivationRequest.count({ where });
    return { data, nextCursor, total };
  }

  async getById(actor: AuthUser, id: string) {
    return this.loadRequest(actor, id);
  }

  async approve(actor: AuthUser, id: string, dto: ReviewReactivationRequestDto): Promise<{ ok: true }> {
    this.assertReactivatePermission(actor);
    const request = await this.loadRequest(actor, id);
    if (request.status !== ReactivationRequestStatus.PENDING) {
      throw new BadRequestException('Only pending reactivation requests can be approved');
    }
    const notes = dto.reviewNotes?.trim();
    const reasonBase = request.justification.slice(0, 4000);
    const reason = notes
      ? `Reactivation approved. Review: ${notes}. Original: ${reasonBase}`
      : `Reactivation approved. Original request: ${reasonBase}`;

    await this.statusChanges.changeEnrollmentStatus({
      institutionId: actor.institutionId,
      actorUserId: actor.userId,
      studentId: request.studentId,
      toStatus: StudentEnrollmentStatusEnum.ACTIVE,
      reason,
    });

    await this.prisma.reactivationRequest.update({
      where: { id: request.id },
      data: {
        status: ReactivationRequestStatus.APPROVED,
        reviewedBy: actor.userId,
        reviewedAt: new Date(),
        reviewNotes: notes ?? null,
      },
    });

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'student.reactivation.approved',
      entity: 'ReactivationRequest',
      entityId: id,
      oldValues: { status: request.status } as Prisma.InputJsonValue,
      newValues: {
        status: ReactivationRequestStatus.APPROVED,
        studentId: request.studentId,
        billingImplication: 'GAIN',
      } as Prisma.InputJsonValue,
    });

    return { ok: true as const };
  }

  async reject(actor: AuthUser, id: string, dto: ReviewReactivationRequestDto): Promise<{ ok: true }> {
    this.assertReactivatePermission(actor);
    const request = await this.loadRequest(actor, id);
    if (request.status !== ReactivationRequestStatus.PENDING) {
      throw new BadRequestException('Only pending reactivation requests can be rejected');
    }
    const notes = dto.reviewNotes?.trim() ?? null;

    await this.prisma.reactivationRequest.update({
      where: { id: request.id },
      data: {
        status: ReactivationRequestStatus.REJECTED,
        reviewedBy: actor.userId,
        reviewedAt: new Date(),
        reviewNotes: notes,
      },
    });

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'student.reactivation.rejected',
      entity: 'ReactivationRequest',
      entityId: id,
      oldValues: { status: request.status } as Prisma.InputJsonValue,
      newValues: { status: ReactivationRequestStatus.REJECTED, reviewNotes: notes } as Prisma.InputJsonValue,
    });

    return { ok: true as const };
  }
}
