import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { GpaRepeatPolicy } from '@prisma/client';
import { Prisma, StudentEnrollmentStatusEnum } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import type { CreateStudentDto } from './dto/create-student.dto';
import type { InitiatePermanentDeletionDto } from './deletion/dto/initiate-permanent-deletion.dto';
import type { ListStudentsQueryDto } from './dto/list-students-query.dto';
import type { ConfirmGraduationDto } from './dto/confirm-graduation.dto';
import type { ImportStudentsBatchDto } from './dto/import-students-batch.dto';
import type { UpdateStudentDto } from './dto/update-student.dto';
import { StatusChangeService } from './status/status-change.service';
import {
  StudentsRepository,
  type EnrollmentForGpaRow,
  type StudentWithUserProgram,
} from './students.repository';
import { GpaComputationService } from '../progression/gpa-computation.service';
import { ProgressionService } from '../progression/progression.service';

type InstitutionSettings = {
  studentNumberFormat?: string;
};

export type AcademicStanding = 'GOOD' | 'PROBATION' | 'SUSPENSION';

@Injectable()
export class StudentsService {
  constructor(
    private readonly repo: StudentsRepository,
    private readonly audit: AuditService,
    private readonly statusChanges: StatusChangeService,
    private readonly prisma: PrismaService,
    private readonly workflows: WorkflowEngineService,
    private readonly progression: ProgressionService,
    private readonly gpaComputation: GpaComputationService,
  ) {}

  private defaultFormat() {
    return '{year}/{code}/{seq}';
  }

  async buildStudentNumberForProgram(
    institutionId: string,
    programId: string,
    programCode: string,
    admissionDate: Date | undefined,
  ): Promise<string> {
    const inst = await this.repo.getInstitutionSettings(institutionId);
    const settings = (inst?.settings ?? {}) as InstitutionSettings;
    const template = settings.studentNumberFormat?.trim() || this.defaultFormat();
    const ref = admissionDate ?? new Date();
    const year = ref.getFullYear();
    const yearStart = new Date(year, 0, 1);
    const seq =
      (await this.repo.countStudentsForNumbering(institutionId, programId, yearStart)) + 1;
    const seqPadded = String(seq).padStart(3, '0');
    const safeCode = programCode.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12) || 'PG';
    return template
      .replaceAll('{year}', String(year))
      .replaceAll('{code}', safeCode)
      .replaceAll('{seq}', seqPadded);
  }

  async list(actor: AuthUser, query: ListStudentsQueryDto) {
    const limit = query.limit ?? 20;
    const entityScopeId = actor.entityScope === 'ENTITY' ? actor.entityId : undefined;

    if (query.search?.trim()) {
      const ids = await this.repo.searchStudentIdsPage({
        institutionId: actor.institutionId,
        entityId: entityScopeId,
        search: query.search,
        programId: query.programId,
        enrollmentStatus: query.enrollmentStatus,
        cursor: query.cursor,
        take: limit + 1,
      });
      const total = await this.repo.countSearchMatches({
        institutionId: actor.institutionId,
        entityId: entityScopeId,
        search: query.search,
        programId: query.programId,
        enrollmentStatus: query.enrollmentStatus,
      });

      let nextCursor: string | undefined;
      let pageIds = ids;
      if (ids.length > limit) {
        pageIds = ids.slice(0, limit);
        nextCursor = pageIds[pageIds.length - 1];
      }

      const rows = await this.repo.findOrderedByIds(pageIds, actor.institutionId);
      const data = await this.attachListAcademicMetrics(actor.institutionId, rows);
      return { data, nextCursor, total };
    }

    const whereInput = this.repo.buildWhere({
      institutionId: actor.institutionId,
      entityId: entityScopeId,
      search: undefined,
      programId: query.programId,
      enrollmentStatus: query.enrollmentStatus,
    });
    const rows = await this.repo.findPage(whereInput, limit, query.cursor);
    let nextCursor: string | undefined;
    if (rows.length > limit) {
      const last = rows.pop();
      nextCursor = last?.id;
    }
    const total = await this.repo.countWhere(whereInput);
    const data = await this.attachListAcademicMetrics(actor.institutionId, rows);
    return {
      data,
      nextCursor,
      total,
    };
  }

  async getById(actor: AuthUser, id: string) {
    const row = await this.repo.findById(actor.institutionId, id);
    if (!row) {
      throw new NotFoundException('Student not found');
    }
    return await this.serializeDetail(row);
  }

  async listStatusChangeLogs(actor: AuthUser, studentId: string) {
    const student = await this.repo.findById(actor.institutionId, studentId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    const rows = await this.repo.findStatusChangeLogsForStudent(actor.institutionId, studentId, 80);
    return {
      data: rows.map((r) => ({
        id: r.id,
        fromStatus: r.fromStatus,
        toStatus: r.toStatus,
        reason: r.reason,
        billingImplication: r.billingImplication,
        recordedAt: r.recordedAt,
        actorRole: r.actor.role,
      })),
    };
  }

  async create(actor: AuthUser, dto: CreateStudentDto) {
    const admissionDate = dto.admissionDate ? new Date(dto.admissionDate) : undefined;
    let entityId = dto.entityId?.trim();
    if (entityId) {
      const ent = await this.repo.findEntityForStudent(actor.institutionId, entityId);
      if (!ent) {
        throw new NotFoundException('Campus entity not found for this institution');
      }
    } else {
      const main = await this.repo.findDefaultMainEntityId(actor.institutionId);
      entityId = main?.id;
    }
    if (!entityId) {
      throw new BadRequestException(
        'No active MAIN campus entity exists for this institution. Complete institution provisioning first.',
      );
    }

    const program = await this.repo.findProgramInInstitution(actor.institutionId, dto.programId);
    if (!program) {
      throw new NotFoundException('Program not found');
    }
    if (program.entityId !== entityId) {
      throw new BadRequestException('Program does not belong to the selected campus entity');
    }
    const existing = await this.repo.findUserByEmailInInstitution(actor.institutionId, dto.email);
    if (existing) {
      throw new ConflictException('Email already in use at this institution');
    }
    const studentNumber = await this.buildStudentNumberForProgram(
      actor.institutionId,
      program.id,
      program.code,
      admissionDate,
    );
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const profile: Prisma.InputJsonValue = {
      firstName: dto.firstName,
      lastName: dto.lastName,
    };
    try {
      const student = await this.repo.createUserAndStudent({
        institutionId: actor.institutionId,
        entityId,
        email: dto.email,
        passwordHash,
        profile,
        programId: program.id,
        studentNumber,
        currentLevel: dto.currentLevel ?? 1,
        admissionDate,
        expectedGraduationDate: dto.expectedGraduationDate
          ? new Date(dto.expectedGraduationDate)
          : undefined,
        guardians: (dto.guardians ?? []) as Prisma.InputJsonValue,
        emergencyContacts: (dto.emergencyContacts ?? []) as Prisma.InputJsonValue,
        specialNeeds: (dto.specialNeeds ?? {}) as Prisma.InputJsonValue,
        photo: dto.photo,
      });
      this.audit.append({
        institutionId: actor.institutionId,
        actorId: actor.userId,
        action: 'student.create',
        entity: 'Student',
        entityId: student.id,
        newValues: {
          studentNumber: student.studentNumber,
          programId: program.id,
          userId: student.userId,
          email: dto.email,
          entityId: student.entityId,
        },
      });
      return this.serializeListItem(student);
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Could not allocate a unique student number; retry');
      }
      throw e instanceof Error ? e : new Error(String(e));
    }
  }

  async importBatch(actor: AuthUser, dto: ImportStudentsBatchDto) {
    const errors: { index: number; message: string }[] = [];
    const created: Awaited<ReturnType<StudentsService['create']>>[] = [];
    for (let index = 0; index < dto.rows.length; index++) {
      try {
        const row = await this.create(actor, dto.rows[index]!);
        created.push(row);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        errors.push({ index, message });
      }
    }

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'students.import_batch',
      entity: 'Student',
      newValues: {
        requested: dto.rows.length,
        created: created.length,
        failed: errors.length,
      },
    });

    return {
      requested: dto.rows.length,
      createdCount: created.length,
      errorCount: errors.length,
      data: created,
      errors,
    };
  }

  async update(actor: AuthUser, id: string, dto: UpdateStudentDto) {
    const prior = await this.repo.findById(actor.institutionId, id);
    if (!prior) {
      throw new NotFoundException('Student not found');
    }
    if (dto.programId) {
      const program = await this.repo.findProgramInInstitution(actor.institutionId, dto.programId);
      if (!program) {
        throw new NotFoundException('Program not found');
      }
      if (program.entityId !== prior.entityId) {
        throw new BadRequestException(
          'Program belongs to a different campus entity than this student',
        );
      }
    }

    let working: StudentWithUserProgram = prior;
    if (dto.enrollmentStatus !== undefined && dto.enrollmentStatus !== prior.enrollmentStatus) {
      if (!dto.statusChangeReason?.trim()) {
        throw new BadRequestException(
          'statusChangeReason is required when changing enrollmentStatus (immutable audit trail)',
        );
      }
      working = await this.statusChanges.changeEnrollmentStatus({
        institutionId: actor.institutionId,
        actorUserId: actor.userId,
        studentId: id,
        toStatus: dto.enrollmentStatus,
        reason: dto.statusChangeReason.trim(),
      });
    }

    const data: Prisma.StudentUpdateInput = {};
    if (dto.programId !== undefined) {
      data.program = { connect: { id: dto.programId } };
    }
    if (dto.currentLevel !== undefined) {
      data.currentLevel = dto.currentLevel;
    }
    if (dto.admissionDate !== undefined) {
      data.admissionDate = dto.admissionDate ? new Date(dto.admissionDate) : null;
    }
    if (dto.expectedGraduationDate !== undefined) {
      data.expectedGraduationDate = dto.expectedGraduationDate
        ? new Date(dto.expectedGraduationDate)
        : null;
    }
    if (dto.guardians !== undefined) {
      data.guardians = dto.guardians as Prisma.InputJsonValue;
    }
    if (dto.emergencyContacts !== undefined) {
      data.emergencyContacts = dto.emergencyContacts as Prisma.InputJsonValue;
    }
    if (dto.specialNeeds !== undefined) {
      data.specialNeeds = dto.specialNeeds as Prisma.InputJsonValue;
    }
    if (dto.photo !== undefined) {
      data.photo = dto.photo;
    }

    if (Object.keys(data).length === 0) {
      return this.serializeListItem(working);
    }

    const updated = await this.repo.updateStudent(actor.institutionId, id, data);
    if (!updated) {
      throw new NotFoundException('Student not found');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'student.update',
      entity: 'Student',
      entityId: id,
      oldValues: {
        programId: prior.program.id,
        currentLevel: prior.currentLevel,
        enrollmentStatus: prior.enrollmentStatus,
        admissionDate: prior.admissionDate,
        expectedGraduationDate: prior.expectedGraduationDate,
      },
      newValues: {
        programId: updated.program.id,
        currentLevel: updated.currentLevel,
        enrollmentStatus: updated.enrollmentStatus,
        admissionDate: updated.admissionDate,
        expectedGraduationDate: updated.expectedGraduationDate,
      },
    });
    return this.serializeListItem(updated);
  }

  async remove(actor: AuthUser, id: string) {
    const prior = await this.repo.findById(actor.institutionId, id);
    if (!prior) {
      throw new NotFoundException('Student not found');
    }
    const result = await this.repo.softDeleteStudent(actor.institutionId, id, new Date());
    if (result.count === 0) {
      throw new NotFoundException('Student not found');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'student.delete',
      entity: 'Student',
      entityId: id,
      oldValues: { studentNumber: prior.studentNumber, userId: prior.userId },
      newValues: { softDeleted: true },
    });
    return { ok: true as const, id };
  }

  private async attachListAcademicMetrics(institutionId: string, rows: StudentWithUserProgram[]) {
    if (rows.length === 0) {
      return [];
    }
    const enrollments = await this.repo.findEnrollmentsForGpaByStudentIds(
      institutionId,
      rows.map((r) => r.id),
    );
    const byStudent = new Map<string, EnrollmentForGpaRow[]>();
    for (const e of enrollments) {
      const list = byStudent.get(e.studentId) ?? [];
      list.push(e);
      byStudent.set(e.studentId, list);
    }
    const programIds = [...new Set(rows.map((r) => r.programId))];
    const policyByProgram = new Map<string, GpaRepeatPolicy>();
    for (const pid of programIds) {
      policyByProgram.set(pid, await this.progression.resolveGpaRepeatPolicy(institutionId, pid));
    }

    return rows.map((s) => {
      const policy = policyByProgram.get(s.programId) ?? 'BEST_OF_ATTEMPTS';
      const ents = byStudent.get(s.id) ?? [];
      const summary = this.summarizeEnrollmentMetrics(ents, policy, s.enrollmentStatus);
      return {
        ...this.serializeListItem(s),
        academicMetrics: {
          cumulativeGpa: summary.gpa,
          creditHoursAttempted: summary.creditHoursAttempted,
          creditHoursCompleted: summary.creditHoursEarned,
          academicStanding: summary.standing,
        },
      };
    });
  }

  /** GPA + credits from enrollment rows using programme repeat policy (Phase 7 list + detail). */
  private summarizeEnrollmentMetrics(
    enrollmentRows: Array<Pick<EnrollmentForGpaRow, 'status' | 'grade' | 'semester' | 'section'>>,
    policy: GpaRepeatPolicy,
    enrollmentStatus: StudentEnrollmentStatusEnum,
  ): {
    gpa: number | null;
    creditHoursAttempted: number;
    creditHoursEarned: number;
    standing: AcademicStanding;
  } {
    const gpaRows = this.gpaComputation.rowsFromEnrollments(
      enrollmentRows.map((e) => ({
        status: e.status,
        grade: e.grade,
        semester: e.semester,
        section: e.section,
      })),
    );
    const summary = this.gpaComputation.summarizeWithPolicy(gpaRows, policy);
    let standing: AcademicStanding = 'GOOD';
    if (enrollmentStatus === StudentEnrollmentStatusEnum.SUSPENDED) {
      standing = 'SUSPENSION';
    } else if (summary.cumulativeGpa !== null && summary.cumulativeGpa < 2) {
      standing = 'PROBATION';
    }
    return {
      gpa: summary.cumulativeGpa,
      creditHoursAttempted: summary.creditHoursAttempted,
      creditHoursEarned: summary.creditHoursEarned,
      standing,
    };
  }

  private serializeListItem(student: StudentWithUserProgram) {
    return {
      id: student.id,
      userId: student.userId,
      entityId: student.entityId,
      entity: student.entity,
      studentNumber: student.studentNumber,
      email: student.user?.email ?? null,
      profile: student.user?.profile ?? null,
      program: student.program,
      currentLevel: student.currentLevel,
      enrollmentStatus: student.enrollmentStatus,
      inactiveReason: student.inactiveReason,
      inactiveSince: student.inactiveSince,
      admissionDate: student.admissionDate,
      expectedGraduationDate: student.expectedGraduationDate,
      graduationConfirmedAt: student.graduationConfirmedAt,
      guardians: student.guardians,
      emergencyContacts: student.emergencyContacts,
      specialNeeds: student.specialNeeds,
      photo: student.photo,
      userActive: student.user?.isActive ?? false,
    };
  }

  private async serializeDetail(
    row: NonNullable<Awaited<ReturnType<StudentsRepository['findById']>>>,
  ) {
    const base = this.serializeListItem(row);
    const metrics = await this.computeMetrics(row);
    return {
      ...base,
      enrollments: row.enrollments.map((e) => this.serializeEnrollment(e)),
      metrics,
    };
  }

  private serializeEnrollment(e: {
    id: string;
    status: string;
    grade: Prisma.JsonValue;
    enrolledAt: Date;
    sectionId: string;
    originalSemesterId: string | null;
    enrollmentAttemptNumber: number;
    semester: { id: string; name: string; startDate: Date };
    section: { course: { id: string; code: string; title: string; creditHours: number } };
  }) {
    return {
      id: e.id,
      status: e.status,
      grade: e.grade,
      enrolledAt: e.enrolledAt,
      semester: e.semester,
      course: e.section.course,
      sectionId: e.sectionId,
      originalSemesterId: e.originalSemesterId,
      enrollmentAttemptNumber: e.enrollmentAttemptNumber,
    };
  }

  async enrollApplicantAsStudent(actor: AuthUser, applicationId: string) {
    const app = await this.prisma.application.findFirst({
      where: { id: applicationId, institutionId: actor.institutionId, deletedAt: null },
      include: {
        applicant: { select: { id: true, email: true, profile: true, role: true } },
        program: { select: { id: true, code: true, entityId: true } },
        student: { select: { id: true, studentNumber: true } },
      },
    });
    if (!app) {
      throw new NotFoundException('Application not found');
    }
    if (app.acceptedStudentId && app.student) {
      return {
        studentId: app.student.id,
        studentNumber: app.student.studentNumber,
        existing: true as const,
      };
    }
    const existingStudent = await this.repo.findStudentByUserId(
      actor.institutionId,
      app.applicantId,
    );
    if (existingStudent) {
      throw new ConflictException('Applicant already has a student record');
    }
    const program = await this.repo.findProgramInInstitution(actor.institutionId, app.programId);
    if (!program) {
      throw new NotFoundException('Program not found');
    }
    const entityId = program.entityId;
    const studentNumber = await this.buildStudentNumberForProgram(
      actor.institutionId,
      program.id,
      program.code,
      new Date(),
    );
    const student = await this.repo.createStudentForExistingUser({
      institutionId: actor.institutionId,
      entityId,
      userId: app.applicantId,
      programId: program.id,
      studentNumber,
      currentLevel: 1,
      admissionDate: new Date(),
    });
    await this.prisma.user.update({
      where: { id: app.applicantId },
      data: { role: 'STUDENT' },
    });
    await this.prisma.application.update({
      where: { id: app.id },
      data: {
        status: 'ACCEPTED',
        acceptedStudentId: student.id,
        reviewedById: actor.userId,
        reviewedAt: new Date(),
      },
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'application.enroll_student',
      entity: 'Application',
      entityId: app.id,
      newValues: { studentId: student.id, studentNumber: student.studentNumber },
    });
    return {
      studentId: student.id,
      studentNumber: student.studentNumber,
      existing: false as const,
    };
  }

  async confirmGraduation(actor: AuthUser, studentId: string, dto: ConfirmGraduationDto) {
    const prior = await this.repo.findById(actor.institutionId, studentId);
    if (!prior) {
      throw new NotFoundException('Student not found');
    }
    if (actor.entityScope === 'ENTITY' && prior.entityId !== actor.entityId) {
      throw new NotFoundException('Student not found');
    }
    if (prior.enrollmentStatus !== StudentEnrollmentStatusEnum.ACTIVE) {
      throw new BadRequestException('Only ACTIVE students can be confirmed for graduation');
    }

    await this.statusChanges.changeEnrollmentStatus({
      institutionId: actor.institutionId,
      actorUserId: actor.userId,
      studentId,
      toStatus: StudentEnrollmentStatusEnum.GRADUATED,
      reason: dto.reason.trim(),
      inactiveReason: 'GRADUATED',
    });

    const withGradDate = await this.prisma.student.update({
      where: { id: studentId },
      data: { graduationConfirmedAt: new Date() },
      include: {
        user: { select: { id: true, email: true, profile: true, isActive: true } },
        program: { select: { id: true, name: true, code: true } },
        entity: { select: { id: true, code: true, name: true, type: true, status: true } },
      },
    });

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'student.graduation_confirmed',
      entity: 'Student',
      entityId: studentId,
      oldValues: { enrollmentStatus: prior.enrollmentStatus },
      newValues: {
        enrollmentStatus: StudentEnrollmentStatusEnum.GRADUATED,
        graduationConfirmedAt: withGradDate.graduationConfirmedAt?.toISOString() ?? null,
        notes: dto.notes ?? null,
      },
    });

    return {
      id: withGradDate.id,
      studentNumber: withGradDate.studentNumber,
      enrollmentStatus: withGradDate.enrollmentStatus,
      graduationConfirmedAt: withGradDate.graduationConfirmedAt,
      inactiveReason: withGradDate.inactiveReason,
      inactiveSince: withGradDate.inactiveSince,
    };
  }

  async initiatePermanentDeletion(
    actor: AuthUser,
    studentId: string,
    dto: InitiatePermanentDeletionDto,
  ): Promise<{ workflowInstanceId: string; studentId: string }> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId: actor.institutionId, deletedAt: null },
      select: { id: true, entityId: true, studentNumber: true, enrollmentStatus: true },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (actor.entityScope === 'ENTITY' && student.entityId !== actor.entityId) {
      throw new NotFoundException('Student not found');
    }
    if (student.enrollmentStatus === StudentEnrollmentStatusEnum.ACTIVE) {
      throw new BadRequestException('Student must be inactive before permanent deletion');
    }
    if (student.enrollmentStatus === StudentEnrollmentStatusEnum.PERMANENTLY_DELETED) {
      throw new BadRequestException('Student is already permanently deleted');
    }
    if (dto.typedStudentNumber.trim() !== student.studentNumber) {
      throw new BadRequestException('Typed student number does not match');
    }

    const pending = await this.prisma.workflowInstance.findFirst({
      where: {
        institutionId: actor.institutionId,
        definitionCode: 'STUDENT_PERMANENT_DELETION',
        entityId_record: student.id,
        status: 'IN_PROGRESS',
      },
      select: { id: true },
    });
    if (pending) {
      throw new ConflictException('A permanent deletion workflow is already in progress');
    }

    const workflow = await this.workflows.initiateWorkflow({
      institutionId: actor.institutionId,
      entityId: student.entityId,
      definitionCode: 'STUDENT_PERMANENT_DELETION',
      entityType: 'Student',
      entityId_record: student.id,
      initiatedBy: actor.userId,
      metadata: {
        studentId: student.id,
        typedStudentNumber: dto.typedStudentNumber.trim(),
        justification: dto.justification.trim(),
      },
    });

    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'student.permanent_deletion.initiated',
      entity: 'Student',
      entityId: student.id,
      newValues: {
        workflowInstanceId: workflow.id,
        studentNumber: student.studentNumber,
      } as Prisma.InputJsonValue,
    });

    return { workflowInstanceId: workflow.id, studentId: student.id };
  }

  private async computeMetrics(
    row: NonNullable<Awaited<ReturnType<StudentsRepository['findById']>>>,
  ): Promise<{
    gpa: number | null;
    creditHoursAttempted: number;
    creditHoursEarned: number;
    standing: AcademicStanding;
    gpaRepeatPolicy: GpaRepeatPolicy;
  }> {
    const policy = await this.progression.resolveGpaRepeatPolicy(row.institutionId, row.program.id);
    const summary = this.summarizeEnrollmentMetrics(row.enrollments, policy, row.enrollmentStatus);
    return {
      gpa: summary.gpa,
      creditHoursAttempted: summary.creditHoursAttempted,
      creditHoursEarned: summary.creditHoursEarned,
      standing: summary.standing,
      gpaRepeatPolicy: policy,
    };
  }
}
