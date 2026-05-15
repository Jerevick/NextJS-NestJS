import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AdmissionCycleStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import type { CreateAdmissionCycleDto } from './dto/create-admission-cycle.dto';
import type { CreateApplicationDto } from './dto/create-application.dto';
import type { CreateApplicationFormDto } from './dto/create-application-form.dto';
import type { ListApplicationsQueryDto } from './dto/list-applications-query.dto';
import type { ListCyclesQueryDto } from './dto/list-cycles-query.dto';
import type { UpdateAdmissionCycleDto } from './dto/update-admission-cycle.dto';
import type { UpdateApplicationDto } from './dto/update-application.dto';
import type { UpdateApplicationFormDto } from './dto/update-application-form.dto';
import { StudentsService } from '../students/students.service';
import { AdmissionsRepository } from './admissions.repository';

@Injectable()
export class AdmissionsService {
  constructor(
    private readonly repo: AdmissionsRepository,
    private readonly audit: AuditService,
    private readonly students: StudentsService,
  ) {}

  enrollStudentFromApplication(actor: AuthUser, applicationId: string) {
    return this.students.enrollApplicantAsStudent(actor, applicationId);
  }

  private assertDateOrder(open: Date, close: Date) {
    if (Number.isNaN(open.getTime()) || Number.isNaN(close.getTime())) {
      throw new BadRequestException('Invalid date range');
    }
    if (open >= close) {
      throw new BadRequestException('applicationOpenDate must be before applicationCloseDate');
    }
  }

  private assertCycleAcceptsApplications(cycle: {
    status: AdmissionCycleStatus;
    applicationOpenDate: Date;
    applicationCloseDate: Date;
  }) {
    if (cycle.status !== 'OPEN') {
      throw new BadRequestException('This admission cycle is not open for applications');
    }
    const now = new Date();
    if (now < cycle.applicationOpenDate || now > cycle.applicationCloseDate) {
      throw new BadRequestException('Applications are outside the open/close window for this cycle');
    }
  }

  async createCycle(actor: AuthUser, dto: CreateAdmissionCycleDto) {
    const ay = await this.repo.findAcademicYear(actor.institutionId, dto.academicYearId);
    if (!ay) {
      throw new NotFoundException('Academic year not found');
    }
    const open = new Date(dto.applicationOpenDate);
    const close = new Date(dto.applicationCloseDate);
    this.assertDateOrder(open, close);
    const quota = (dto.quota ?? {}) as Prisma.InputJsonValue;
    const row = await this.repo.createCycle({
      institutionId: actor.institutionId,
      name: dto.name.trim(),
      academicYearId: dto.academicYearId,
      applicationOpenDate: open,
      applicationCloseDate: close,
      status: dto.status ?? 'DRAFT',
      quota,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'admission_cycle.create',
      entity: 'AdmissionCycle',
      entityId: row.id,
      newValues: { name: row.name, status: row.status, academicYearId: row.academicYearId },
    });
    return this.serializeCycle(row);
  }

  async listCycles(actor: AuthUser, query: ListCyclesQueryDto) {
    const limit = query.limit ?? 20;
    const where = this.repo.buildCycleWhere({
      institutionId: actor.institutionId,
      status: query.status,
    });
    const rows = await this.repo.findCyclesPage(where, limit, query.cursor);
    let nextCursor: string | undefined;
    if (rows.length > limit) {
      const last = rows.pop();
      nextCursor = last?.id;
    }
    const total = await this.repo.countCycles(where);
    return { data: rows.map((r) => this.serializeCycle(r)), nextCursor, total };
  }

  async getCycle(actor: AuthUser, cycleId: string) {
    const row = await this.repo.findCycle(actor.institutionId, cycleId);
    if (!row) {
      throw new NotFoundException('Admission cycle not found');
    }
    return this.serializeCycle(row);
  }

  async updateCycle(actor: AuthUser, cycleId: string, dto: UpdateAdmissionCycleDto) {
    const existing = await this.repo.findCycle(actor.institutionId, cycleId);
    if (!existing) {
      throw new NotFoundException('Admission cycle not found');
    }
    const data: Prisma.AdmissionCycleUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    let open = existing.applicationOpenDate;
    let close = existing.applicationCloseDate;
    if (dto.applicationOpenDate !== undefined) {
      open = new Date(dto.applicationOpenDate);
      data.applicationOpenDate = open;
    }
    if (dto.applicationCloseDate !== undefined) {
      close = new Date(dto.applicationCloseDate);
      data.applicationCloseDate = close;
    }
    this.assertDateOrder(open, close);
    if (dto.status !== undefined) {
      data.status = dto.status;
    }
    if (dto.quota !== undefined) {
      data.quota = dto.quota as Prisma.InputJsonValue;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    const row = await this.repo.updateCycle(existing.id, data);
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'admission_cycle.update',
      entity: 'AdmissionCycle',
      entityId: existing.id,
      oldValues: {
        name: existing.name,
        status: existing.status,
        applicationOpenDate: existing.applicationOpenDate,
        applicationCloseDate: existing.applicationCloseDate,
      },
      newValues: {
        name: row.name,
        status: row.status,
        applicationOpenDate: row.applicationOpenDate,
        applicationCloseDate: row.applicationCloseDate,
      },
    });
    return this.serializeCycle(row);
  }

  async removeCycle(actor: AuthUser, cycleId: string) {
    const existing = await this.repo.findCycle(actor.institutionId, cycleId);
    if (!existing) {
      throw new NotFoundException('Admission cycle not found');
    }
    const n = await this.repo.softDeleteCycle(actor.institutionId, cycleId, new Date());
    if (n.count === 0) {
      throw new NotFoundException('Admission cycle not found');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'admission_cycle.delete',
      entity: 'AdmissionCycle',
      entityId: cycleId,
      oldValues: { name: existing.name, status: existing.status },
      newValues: { softDeleted: true },
    });
    return { ok: true as const, id: cycleId };
  }

  async listForms(actor: AuthUser, cycleId: string) {
    await this.ensureCycle(actor.institutionId, cycleId);
    const rows = await this.repo.listForms(actor.institutionId, cycleId);
    return rows.map((f) => this.serializeForm(f));
  }

  async createForm(actor: AuthUser, cycleId: string, dto: CreateApplicationFormDto) {
    await this.ensureCycle(actor.institutionId, cycleId);
    const row = await this.repo.createForm({
      institutionId: actor.institutionId,
      cycleId,
      schema: dto.schema as Prisma.InputJsonValue,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'application_form.create',
      entity: 'ApplicationForm',
      entityId: row.id,
      newValues: { cycleId, formId: row.id },
    });
    return this.serializeForm(row);
  }

  async getForm(actor: AuthUser, formId: string) {
    const row = await this.repo.findForm(actor.institutionId, formId);
    if (!row) {
      throw new NotFoundException('Application form not found');
    }
    return this.serializeForm(row);
  }

  async updateForm(actor: AuthUser, formId: string, dto: UpdateApplicationFormDto) {
    const existing = await this.repo.findForm(actor.institutionId, formId);
    if (!existing) {
      throw new NotFoundException('Application form not found');
    }
    const row = await this.repo.updateForm(existing.id, dto.schema as Prisma.InputJsonValue);
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'application_form.update',
      entity: 'ApplicationForm',
      entityId: existing.id,
      oldValues: { cycleId: existing.cycleId },
      newValues: { cycleId: row.cycleId },
    });
    return this.serializeForm(row);
  }

  async removeForm(actor: AuthUser, formId: string) {
    const existing = await this.repo.findForm(actor.institutionId, formId);
    if (!existing) {
      throw new NotFoundException('Application form not found');
    }
    const n = await this.repo.softDeleteForm(actor.institutionId, formId, new Date());
    if (n.count === 0) {
      throw new NotFoundException('Application form not found');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'application_form.delete',
      entity: 'ApplicationForm',
      entityId: formId,
      oldValues: { cycleId: existing.cycleId },
      newValues: { softDeleted: true },
    });
    return { ok: true as const, id: formId };
  }

  async createApplication(actor: AuthUser, dto: CreateApplicationDto) {
    const cycle = await this.repo.findCycle(actor.institutionId, dto.cycleId);
    if (!cycle) {
      throw new NotFoundException('Admission cycle not found');
    }
    this.assertCycleAcceptsApplications(cycle);

    const program = await this.repo.findProgram(actor.institutionId, dto.programId);
    if (!program) {
      throw new NotFoundException('Program not found');
    }
    const applicant = await this.repo.findUser(actor.institutionId, dto.applicantId);
    if (!applicant) {
      throw new BadRequestException('Applicant user not found in this institution');
    }

    const dup = await this.repo.findDuplicateApplication(
      actor.institutionId,
      dto.cycleId,
      dto.applicantId,
      dto.programId,
    );
    if (dup) {
      throw new ConflictException('An application for this applicant, cycle, and program already exists');
    }

    const documents = (dto.documents ?? []) as Prisma.InputJsonValue;
    const row = await this.repo.createApplication({
      institutionId: actor.institutionId,
      cycleId: dto.cycleId,
      programId: dto.programId,
      applicantId: dto.applicantId,
      personalStatement: dto.personalStatement?.trim() ?? null,
      documents,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'application.create',
      entity: 'Application',
      entityId: row.id,
      newValues: {
        cycleId: dto.cycleId,
        programId: dto.programId,
        applicantId: dto.applicantId,
        status: row.status,
      },
    });
    return this.serializeApplication(row);
  }

  async listApplications(actor: AuthUser, query: ListApplicationsQueryDto) {
    if (query.cycleId) {
      await this.ensureCycle(actor.institutionId, query.cycleId);
    }
    if (query.applicantId) {
      const u = await this.repo.findUser(actor.institutionId, query.applicantId);
      if (!u) {
        throw new BadRequestException('Applicant filter user not found in this institution');
      }
    }
    const limit = query.limit ?? 20;
    const where = this.repo.buildApplicationWhere({
      institutionId: actor.institutionId,
      cycleId: query.cycleId,
      status: query.status,
      applicantId: query.applicantId,
    });
    const rows = await this.repo.findApplicationsPage(where, limit, query.cursor);
    let nextCursor: string | undefined;
    if (rows.length > limit) {
      const last = rows.pop();
      nextCursor = last?.id;
    }
    const total = await this.repo.countApplications(where);
    return { data: rows.map((r) => this.serializeApplication(r)), nextCursor, total };
  }

  async getApplication(actor: AuthUser, id: string) {
    const row = await this.repo.findApplication(actor.institutionId, id);
    if (!row) {
      throw new NotFoundException('Application not found');
    }
    return this.serializeApplication(row);
  }

  async updateApplication(actor: AuthUser, id: string, dto: UpdateApplicationDto) {
    const existing = await this.repo.findApplication(actor.institutionId, id);
    if (!existing) {
      throw new NotFoundException('Application not found');
    }

    const data: Prisma.ApplicationUpdateInput = {};
    if (dto.status !== undefined) {
      data.status = dto.status;
    }
    if (dto.status !== undefined || dto.reviewNotes !== undefined) {
      data.reviewer = { connect: { id: actor.userId } };
      data.reviewedAt = new Date();
    }
    if (dto.personalStatement !== undefined) {
      data.personalStatement = dto.personalStatement.trim();
    }
    if (dto.documents !== undefined) {
      data.documents = dto.documents as Prisma.InputJsonValue;
    }
    if (dto.reviewNotes !== undefined) {
      data.reviewNotes = dto.reviewNotes as Prisma.InputJsonValue;
    }
    if (dto.acceptedStudentId !== undefined) {
      const st = await this.repo.findStudent(actor.institutionId, dto.acceptedStudentId);
      if (!st) {
        throw new BadRequestException('Accepted student not found in this institution');
      }
      data.student = { connect: { id: dto.acceptedStudentId } };
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const row = await this.repo.updateApplication(existing.id, data);
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'application.update',
      entity: 'Application',
      entityId: existing.id,
      oldValues: { status: existing.status, programId: existing.programId },
      newValues: { status: row.status, programId: row.programId },
    });
    return this.serializeApplication(row);
  }

  async removeApplication(actor: AuthUser, id: string) {
    const existing = await this.repo.findApplication(actor.institutionId, id);
    if (!existing) {
      throw new NotFoundException('Application not found');
    }
    const n = await this.repo.softDeleteApplication(actor.institutionId, id, new Date());
    if (n.count === 0) {
      throw new NotFoundException('Application not found');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'application.delete',
      entity: 'Application',
      entityId: id,
      oldValues: { status: existing.status, cycleId: existing.cycleId },
      newValues: { softDeleted: true },
    });
    return { ok: true as const, id };
  }

  private async ensureCycle(institutionId: string, cycleId: string) {
    const c = await this.repo.findCycle(institutionId, cycleId);
    if (!c) {
      throw new NotFoundException('Admission cycle not found');
    }
    return c;
  }

  private serializeCycle(row: NonNullable<Awaited<ReturnType<AdmissionsRepository['findCycle']>>>) {
    return {
      id: row.id,
      name: row.name,
      academicYearId: row.academicYearId,
      applicationOpenDate: row.applicationOpenDate,
      applicationCloseDate: row.applicationCloseDate,
      status: row.status,
      quota: row.quota,
      academicYear: row.academicYear,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private serializeForm(row: NonNullable<Awaited<ReturnType<AdmissionsRepository['findForm']>>>) {
    return {
      id: row.id,
      cycleId: row.cycleId,
      schema: row.schema,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private serializeApplication(row: NonNullable<Awaited<ReturnType<AdmissionsRepository['findApplication']>>>) {
    return {
      id: row.id,
      cycleId: row.cycleId,
      programId: row.programId,
      applicantId: row.applicantId,
      status: row.status,
      personalStatement: row.personalStatement,
      documents: row.documents,
      reviewNotes: row.reviewNotes,
      reviewedById: row.reviewedById,
      reviewedAt: row.reviewedAt,
      acceptedStudentId: row.acceptedStudentId,
      cycle: row.cycle,
      program: row.program,
      applicant: row.applicant,
      reviewer: row.reviewer,
      student: row.student,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
