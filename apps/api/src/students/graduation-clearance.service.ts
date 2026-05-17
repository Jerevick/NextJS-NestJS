import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GraduationClearanceStatus, Prisma, StudentEnrollmentStatusEnum } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import type { CreateGraduationClearanceDto } from './dto/create-graduation-clearance.dto';

const DEFAULT_DEPARTMENT_CHECKS = [
  { department: 'PROGRAMME', label: 'Programme coordinator (credits)', status: 'PENDING' },
  { department: 'ACADEMIC', label: 'HoD certification', status: 'PENDING' },
  { department: 'FACULTY', label: 'Dean endorsement', status: 'PENDING' },
  { department: 'REGISTRY', label: 'Registrar confirmation', status: 'PENDING' },
  { department: 'FINANCE', label: 'Finance clearance', status: 'PENDING' },
  { department: 'LIBRARY', label: 'Library clearance', status: 'PENDING' },
] as const;

@Injectable()
export class GraduationClearanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly workflows: WorkflowEngineService,
  ) {}

  private scopeEntityId(actor: AuthUser): string | undefined {
    return actor.entityScope === 'ALL' ? undefined : actor.entityId;
  }

  private async loadStudent(actor: AuthUser, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId: actor.institutionId, deletedAt: null },
      select: {
        id: true,
        entityId: true,
        studentNumber: true,
        enrollmentStatus: true,
        graduationConfirmedAt: true,
      },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (actor.entityScope === 'ENTITY' && student.entityId !== actor.entityId) {
      throw new ForbiddenException('Student is outside your campus entity scope');
    }
    return student;
  }

  async listForStudent(actor: AuthUser, studentId: string) {
    await this.loadStudent(actor, studentId);
    const scope = this.scopeEntityId(actor);
    const rows = await this.prisma.graduationClearanceRequest.findMany({
      where: {
        institutionId: actor.institutionId,
        studentId,
        ...(scope ? { entityId: scope } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return { data: rows.map((r) => this.serialize(r)), total: rows.length };
  }

  async create(actor: AuthUser, dto: CreateGraduationClearanceDto) {
    const student = await this.loadStudent(actor, dto.studentId.trim());
    if (student.graduationConfirmedAt) {
      throw new BadRequestException('Student graduation is already confirmed');
    }
    if (student.enrollmentStatus === StudentEnrollmentStatusEnum.PERMANENTLY_DELETED) {
      throw new BadRequestException('Student record is permanently deleted');
    }

    const pending = await this.prisma.graduationClearanceRequest.findFirst({
      where: {
        institutionId: actor.institutionId,
        studentId: student.id,
        status: { in: [GraduationClearanceStatus.PENDING, GraduationClearanceStatus.IN_PROGRESS] },
      },
      select: { id: true },
    });
    if (pending) {
      throw new ConflictException(
        'A graduation clearance request is already in progress for this student',
      );
    }

    const departmentChecks = DEFAULT_DEPARTMENT_CHECKS.map((d) => ({ ...d }));
    const created = await this.prisma.graduationClearanceRequest.create({
      data: {
        institutionId: actor.institutionId,
        entityId: student.entityId,
        studentId: student.id,
        requestedBy: actor.userId,
        justification: dto.justification?.trim() ?? null,
        status: GraduationClearanceStatus.PENDING,
        departmentChecks: departmentChecks as Prisma.InputJsonValue,
      },
    });

    const instance = await this.workflows.initiateWorkflow({
      institutionId: actor.institutionId,
      entityId: student.entityId,
      definitionCode: 'GRADUATION_CLEARANCE',
      entityType: 'GraduationClearanceRequest',
      entityId_record: created.id,
      initiatedBy: actor.userId,
      metadata: {
        studentId: student.id,
        studentNumber: student.studentNumber,
        justification: dto.justification ?? null,
      },
    });

    await this.prisma.graduationClearanceRequest.update({
      where: { id: created.id },
      data: {
        workflowInstanceId: instance.id,
        status: GraduationClearanceStatus.IN_PROGRESS,
      },
    });

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'graduation_clearance.create',
      entity: 'GraduationClearanceRequest',
      entityId: created.id,
      newValues: { studentId: student.id, workflowInstanceId: instance.id },
    });

    return this.serialize({
      ...created,
      workflowInstanceId: instance.id,
      status: GraduationClearanceStatus.IN_PROGRESS,
    });
  }

  async getById(actor: AuthUser, id: string) {
    const scope = this.scopeEntityId(actor);
    const row = await this.prisma.graduationClearanceRequest.findFirst({
      where: {
        id,
        institutionId: actor.institutionId,
        ...(scope ? { entityId: scope } : {}),
      },
    });
    if (!row) {
      throw new NotFoundException('Graduation clearance request not found');
    }
    return this.serialize(row);
  }

  private serialize(row: {
    id: string;
    studentId: string;
    status: GraduationClearanceStatus;
    justification: string | null;
    workflowInstanceId: string | null;
    departmentChecks: unknown;
    clearedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      studentId: row.studentId,
      status: row.status,
      justification: row.justification,
      workflowInstanceId: row.workflowInstanceId,
      departmentChecks: Array.isArray(row.departmentChecks) ? row.departmentChecks : [],
      clearedAt: row.clearedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
