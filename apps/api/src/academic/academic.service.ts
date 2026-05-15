import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProgramType, SectionMode, SemesterType } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { AcademicRepository } from './academic.repository';
import type {
  CreateAcademicYearDto,
  CreateCourseDto,
  CreateDepartmentDto,
  CreateDivisionDto,
  CreateProgramDto,
  CreateSectionDto,
  CreateSemesterDto,
  CreateTimetableDto,
  ListAcademicQueryDto,
  ListSectionsQueryDto,
  UpdateAcademicYearDto,
  UpdateCourseDto,
  UpdateDepartmentDto,
  UpdateDivisionDto,
  UpdateProgramDto,
  UpdateSectionDto,
  UpdateSemesterDto,
  UpdateTimetableDto,
} from './dto/academic.dto';

function assertRange(start: Date, end: Date, label: string) {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new BadRequestException(`Invalid ${label} dates`);
  }
  if (start >= end) {
    throw new BadRequestException(`${label}: start must be before end`);
  }
}

function parseSemesterType(raw?: string): SemesterType {
  if (!raw) {
    return SemesterType.REGULAR;
  }
  const v = raw.toUpperCase() as SemesterType;
  if (!Object.values(SemesterType).includes(v)) {
    throw new BadRequestException('Invalid semester type');
  }
  return v;
}

function parseProgramType(raw: string): ProgramType {
  const v = raw.toUpperCase() as ProgramType;
  if (!Object.values(ProgramType).includes(v)) {
    throw new BadRequestException('Invalid program type');
  }
  return v;
}

function parseSectionMode(raw?: string): SectionMode {
  if (!raw) {
    return SectionMode.IN_PERSON;
  }
  const u = raw.toUpperCase().replaceAll('-', '_');
  if (u === 'IN_PERSON' || u === 'INPERSON') {
    return SectionMode.IN_PERSON;
  }
  if (u === 'ONLINE') {
    return SectionMode.ONLINE;
  }
  if (u === 'HYBRID') {
    return SectionMode.HYBRID;
  }
  throw new BadRequestException('Invalid section mode');
}

@Injectable()
export class AcademicService {
  constructor(
    private readonly repo: AcademicRepository,
    private readonly audit: AuditService,
  ) {}

  private auditAcademic(
    actor: AuthUser,
    action: string,
    entity: string,
    entityId: string,
    oldValues?: Prisma.InputJsonValue,
    newValues?: Prisma.InputJsonValue,
  ) {
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action,
      entity,
      entityId,
      oldValues,
      newValues,
    });
  }

  private async assertOptionalUser(institutionId: string, userId: string | null | undefined) {
    if (!userId) {
      return;
    }
    const u = await this.repo.findUser(institutionId, userId);
    if (!u) {
      throw new BadRequestException('Referenced user not found in this institution');
    }
  }

  /** When `ENTITY`, queries are limited to the actor's campus entity. */
  private scopeEntityId(actor: AuthUser): string | undefined {
    return actor.entityScope === 'ALL' ? undefined : actor.entityId;
  }

  // --- Years ---
  async listYears(actor: AuthUser, query: ListAcademicQueryDto) {
    const limit = query.limit ?? 20;
    const rows = await this.repo.listYears(actor.institutionId, limit, query.cursor);
    let nextCursor: string | undefined;
    if (rows.length > limit) {
      const last = rows.pop();
      nextCursor = last?.id;
    }
    const total = await this.repo.countYears(actor.institutionId);
    return { data: rows, nextCursor, total };
  }

  async createYear(actor: AuthUser, dto: CreateAcademicYearDto) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    assertRange(start, end, 'Academic year');
    const isCurrent = dto.isCurrent === true;
    const row = await this.repo.createYear({
      institutionId: actor.institutionId,
      name: dto.name.trim(),
      startDate: start,
      endDate: end,
      isCurrent,
    });
    if (isCurrent) {
      await this.repo.clearCurrentYearsExcept(actor.institutionId, row.id);
    }
    const refreshed = await this.repo.findYear(actor.institutionId, row.id);
    this.auditAcademic(actor, 'academic_year.create', 'AcademicYear', refreshed!.id, undefined, {
      name: refreshed!.name,
      isCurrent: refreshed!.isCurrent,
    } as Prisma.InputJsonValue);
    return refreshed!;
  }

  async getYear(actor: AuthUser, yearId: string) {
    const row = await this.repo.findYear(actor.institutionId, yearId);
    if (!row) {
      throw new NotFoundException('Academic year not found');
    }
    return row;
  }

  async updateYear(actor: AuthUser, yearId: string, dto: UpdateAcademicYearDto) {
    const existing = await this.repo.findYear(actor.institutionId, yearId);
    if (!existing) {
      throw new NotFoundException('Academic year not found');
    }
    let start = existing.startDate;
    let end = existing.endDate;
    if (dto.startDate !== undefined) {
      start = new Date(dto.startDate);
    }
    if (dto.endDate !== undefined) {
      end = new Date(dto.endDate);
    }
    assertRange(start, end, 'Academic year');
    const data: Prisma.AcademicYearUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.startDate !== undefined) {
      data.startDate = start;
    }
    if (dto.endDate !== undefined) {
      data.endDate = end;
    }
    if (dto.isCurrent !== undefined) {
      data.isCurrent = dto.isCurrent;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    await this.repo.updateYear(existing.id, data);
    if (dto.isCurrent === true) {
      await this.repo.clearCurrentYearsExcept(actor.institutionId, existing.id);
      await this.repo.updateYear(existing.id, { isCurrent: true });
    }
    const updated = await this.repo.findYear(actor.institutionId, existing.id);
    this.auditAcademic(actor, 'academic_year.update', 'AcademicYear', existing.id, {
      name: existing.name,
      isCurrent: existing.isCurrent,
    } as Prisma.InputJsonValue, {
      name: updated?.name,
      isCurrent: updated?.isCurrent,
    } as Prisma.InputJsonValue);
    return updated!;
  }

  async removeYear(actor: AuthUser, yearId: string) {
    const existing = await this.repo.findYear(actor.institutionId, yearId);
    if (!existing) {
      throw new NotFoundException('Academic year not found');
    }
    const n = await this.repo.softDeleteYear(actor.institutionId, yearId, new Date());
    if (n.count === 0) {
      throw new NotFoundException('Academic year not found');
    }
    this.auditAcademic(actor, 'academic_year.delete', 'AcademicYear', yearId, {
      name: existing.name,
    } as Prisma.InputJsonValue, { softDeleted: true } as Prisma.InputJsonValue);
    return { ok: true as const, id: yearId };
  }

  // --- Semesters ---
  async listSemestersForYear(actor: AuthUser, yearId: string) {
    await this.getYear(actor, yearId);
    return this.repo.listSemestersForYear(actor.institutionId, yearId);
  }

  async createSemester(actor: AuthUser, yearId: string, dto: CreateSemesterDto) {
    const year = await this.getYear(actor, yearId);
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    assertRange(start, end, 'Semester');
    const row = await this.repo.createSemester({
      institutionId: year.institutionId,
      academicYearId: year.id,
      name: dto.name.trim(),
      startDate: start,
      endDate: end,
      type: parseSemesterType(dto.type),
    });
    this.auditAcademic(actor, 'semester.create', 'Semester', row.id, undefined, {
      name: row.name,
      academicYearId: year.id,
    } as Prisma.InputJsonValue);
    return row;
  }

  async getSemester(actor: AuthUser, semesterId: string) {
    const row = await this.repo.findSemester(actor.institutionId, semesterId);
    if (!row) {
      throw new NotFoundException('Semester not found');
    }
    return row;
  }

  async updateSemester(actor: AuthUser, semesterId: string, dto: UpdateSemesterDto) {
    const existing = await this.repo.findSemester(actor.institutionId, semesterId);
    if (!existing) {
      throw new NotFoundException('Semester not found');
    }
    let start = existing.startDate;
    let end = existing.endDate;
    if (dto.startDate !== undefined) {
      start = new Date(dto.startDate);
    }
    if (dto.endDate !== undefined) {
      end = new Date(dto.endDate);
    }
    assertRange(start, end, 'Semester');
    const data: Prisma.SemesterUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.startDate !== undefined) {
      data.startDate = start;
    }
    if (dto.endDate !== undefined) {
      data.endDate = end;
    }
    if (dto.type !== undefined) {
      data.type = parseSemesterType(dto.type);
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    const updated = await this.repo.updateSemester(existing.id, data);
    this.auditAcademic(actor, 'semester.update', 'Semester', existing.id, {
      name: existing.name,
      type: existing.type,
    } as Prisma.InputJsonValue, {
      name: updated.name,
      type: updated.type,
    } as Prisma.InputJsonValue);
    return updated;
  }

  async removeSemester(actor: AuthUser, semesterId: string) {
    const existing = await this.repo.findSemester(actor.institutionId, semesterId);
    if (!existing) {
      throw new NotFoundException('Semester not found');
    }
    const n = await this.repo.softDeleteSemester(actor.institutionId, semesterId, new Date());
    if (n.count === 0) {
      throw new NotFoundException('Semester not found');
    }
    this.auditAcademic(actor, 'semester.delete', 'Semester', semesterId, {
      name: existing.name,
    } as Prisma.InputJsonValue, { softDeleted: true } as Prisma.InputJsonValue);
    return { ok: true as const, id: semesterId };
  }

  // --- Timetables ---
  async listTimetables(actor: AuthUser, semesterId: string) {
    await this.getSemester(actor, semesterId);
    return this.repo.listTimetablesForSemester(actor.institutionId, semesterId);
  }

  async createTimetable(actor: AuthUser, semesterId: string, dto: CreateTimetableDto) {
    await this.getSemester(actor, semesterId);
    const row = await this.repo.createTimetable({
      institutionId: actor.institutionId,
      semesterId,
      isPublished: dto.isPublished === true,
      data: (dto.data ?? {}) as Prisma.InputJsonValue,
      generatedAt: new Date(),
    });
    this.auditAcademic(actor, 'timetable.create', 'Timetable', row.id, undefined, {
      semesterId,
      isPublished: row.isPublished,
    } as Prisma.InputJsonValue);
    return row;
  }

  async getTimetable(actor: AuthUser, id: string) {
    const row = await this.repo.findTimetable(actor.institutionId, id);
    if (!row) {
      throw new NotFoundException('Timetable not found');
    }
    return row;
  }

  async updateTimetable(actor: AuthUser, id: string, dto: UpdateTimetableDto) {
    const existing = await this.repo.findTimetable(actor.institutionId, id);
    if (!existing) {
      throw new NotFoundException('Timetable not found');
    }
    const data: Prisma.TimetableUpdateInput = {};
    if (dto.isPublished !== undefined) {
      data.isPublished = dto.isPublished;
    }
    if (dto.data !== undefined) {
      data.data = dto.data as Prisma.InputJsonValue;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    const updated = await this.repo.updateTimetable(id, data);
    this.auditAcademic(actor, 'timetable.update', 'Timetable', id, {
      isPublished: existing.isPublished,
    } as Prisma.InputJsonValue, { isPublished: updated.isPublished } as Prisma.InputJsonValue);
    return updated;
  }

  async removeTimetable(actor: AuthUser, id: string) {
    const existing = await this.repo.findTimetable(actor.institutionId, id);
    if (!existing) {
      throw new NotFoundException('Timetable not found');
    }
    const n = await this.repo.softDeleteTimetable(actor.institutionId, id, new Date());
    if (n.count === 0) {
      throw new NotFoundException('Timetable not found');
    }
    this.auditAcademic(actor, 'timetable.delete', 'Timetable', id, { semesterId: existing.semesterId } as Prisma.InputJsonValue, {
      softDeleted: true,
    } as Prisma.InputJsonValue);
    return { ok: true as const, id };
  }

  // --- Divisions ---
  async listDivisions(actor: AuthUser, query: ListAcademicQueryDto) {
    const limit = query.limit ?? 20;
    const rows = await this.repo.listDivisions(actor.institutionId, limit, query.cursor);
    let nextCursor: string | undefined;
    if (rows.length > limit) {
      const last = rows.pop();
      nextCursor = last?.id;
    }
    const total = await this.repo.countDivisions(actor.institutionId);
    return { data: rows, nextCursor, total };
  }

  async createDivision(actor: AuthUser, dto: CreateDivisionDto) {
    const code = dto.code.trim();
    const dup = await this.repo.findDivisionByCode(actor.institutionId, code);
    if (dup) {
      throw new ConflictException('Division code already in use');
    }
    if (dto.deanId) {
      await this.assertOptionalUser(actor.institutionId, dto.deanId);
    }
    const row = await this.repo.createDivision({
      institutionId: actor.institutionId,
      name: dto.name.trim(),
      code,
      deanId: dto.deanId ?? null,
    });
    this.auditAcademic(actor, 'division.create', 'AcademicDivision', row.id, undefined, {
      code: row.code,
      name: row.name,
    } as Prisma.InputJsonValue);
    return row;
  }

  async getDivision(actor: AuthUser, divisionId: string) {
    const row = await this.repo.findDivision(actor.institutionId, divisionId);
    if (!row) {
      throw new NotFoundException('Academic division not found');
    }
    return row;
  }

  async updateDivision(actor: AuthUser, divisionId: string, dto: UpdateDivisionDto) {
    const existing = await this.repo.findDivision(actor.institutionId, divisionId);
    if (!existing) {
      throw new NotFoundException('Academic division not found');
    }
    if (dto.code !== undefined && dto.code.trim().toLowerCase() !== existing.code.toLowerCase()) {
      const dup = await this.repo.findDivisionByCode(actor.institutionId, dto.code.trim());
      if (dup && dup.id !== existing.id) {
        throw new ConflictException('Division code already in use');
      }
    }
    if (dto.deanId !== undefined && dto.deanId.length > 0) {
      await this.assertOptionalUser(actor.institutionId, dto.deanId);
    }
    const data: Prisma.AcademicDivisionUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.code !== undefined) {
      data.code = dto.code.trim();
    }
    if (dto.deanId !== undefined) {
      data.dean = dto.deanId ? { connect: { id: dto.deanId } } : { disconnect: true };
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    const updated = await this.repo.updateDivision(existing.id, data);
    this.auditAcademic(actor, 'division.update', 'AcademicDivision', existing.id, {
      name: existing.name,
      code: existing.code,
    } as Prisma.InputJsonValue, { name: updated.name, code: updated.code } as Prisma.InputJsonValue);
    return updated;
  }

  async removeDivision(actor: AuthUser, divisionId: string) {
    const existing = await this.repo.findDivision(actor.institutionId, divisionId);
    if (!existing) {
      throw new NotFoundException('Academic division not found');
    }
    const n = await this.repo.softDeleteDivision(actor.institutionId, divisionId, new Date());
    if (n.count === 0) {
      throw new NotFoundException('Academic division not found');
    }
    this.auditAcademic(actor, 'division.delete', 'AcademicDivision', divisionId, {
      code: existing.code,
    } as Prisma.InputJsonValue, { softDeleted: true } as Prisma.InputJsonValue);
    return { ok: true as const, id: divisionId };
  }

  // --- Departments ---
  async listDepartments(actor: AuthUser, divisionId: string) {
    await this.getDivision(actor, divisionId);
    return this.repo.listDepartmentsForDivision(actor.institutionId, divisionId);
  }

  async createDepartment(actor: AuthUser, divisionId: string, dto: CreateDepartmentDto) {
    await this.getDivision(actor, divisionId);
    const code = dto.code.trim();
    const dup = await this.repo.findDepartmentByCode(actor.institutionId, code);
    if (dup) {
      throw new ConflictException('Department code already in use');
    }
    if (dto.headId) {
      await this.assertOptionalUser(actor.institutionId, dto.headId);
    }
    const row = await this.repo.createDepartment({
      institutionId: actor.institutionId,
      divisionId,
      name: dto.name.trim(),
      code,
      headId: dto.headId ?? null,
    });
    this.auditAcademic(actor, 'department.create', 'Department', row.id, undefined, {
      code: row.code,
      divisionId,
    } as Prisma.InputJsonValue);
    return row;
  }

  async getDepartment(actor: AuthUser, departmentId: string) {
    const row = await this.repo.findDepartment(actor.institutionId, departmentId);
    if (!row) {
      throw new NotFoundException('Department not found');
    }
    return row;
  }

  async updateDepartment(actor: AuthUser, departmentId: string, dto: UpdateDepartmentDto) {
    const existing = await this.repo.findDepartment(actor.institutionId, departmentId);
    if (!existing) {
      throw new NotFoundException('Department not found');
    }
    if (dto.code !== undefined && dto.code.trim().toLowerCase() !== existing.code.toLowerCase()) {
      const dup = await this.repo.findDepartmentByCode(actor.institutionId, dto.code.trim());
      if (dup && dup.id !== existing.id) {
        throw new ConflictException('Department code already in use');
      }
    }
    if (dto.headId !== undefined && dto.headId.length > 0) {
      await this.assertOptionalUser(actor.institutionId, dto.headId);
    }
    const data: Prisma.DepartmentUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.code !== undefined) {
      data.code = dto.code.trim();
    }
    if (dto.headId !== undefined) {
      data.head = dto.headId ? { connect: { id: dto.headId } } : { disconnect: true };
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    const updated = await this.repo.updateDepartment(existing.id, data);
    this.auditAcademic(actor, 'department.update', 'Department', existing.id, {
      name: existing.name,
      code: existing.code,
    } as Prisma.InputJsonValue, { name: updated.name, code: updated.code } as Prisma.InputJsonValue);
    return updated;
  }

  async removeDepartment(actor: AuthUser, departmentId: string) {
    const existing = await this.repo.findDepartment(actor.institutionId, departmentId);
    if (!existing) {
      throw new NotFoundException('Department not found');
    }
    const n = await this.repo.softDeleteDepartment(actor.institutionId, departmentId, new Date());
    if (n.count === 0) {
      throw new NotFoundException('Department not found');
    }
    this.auditAcademic(actor, 'department.delete', 'Department', departmentId, {
      code: existing.code,
    } as Prisma.InputJsonValue, { softDeleted: true } as Prisma.InputJsonValue);
    return { ok: true as const, id: departmentId };
  }

  // --- Programs ---
  async listProgramsForInstitution(actor: AuthUser) {
    return this.repo.listProgramsForInstitution(actor.institutionId, this.scopeEntityId(actor));
  }

  async listSemestersForInstitution(actor: AuthUser) {
    return this.repo.listSemestersForInstitution(actor.institutionId);
  }

  async listPrograms(actor: AuthUser, departmentId: string) {
    await this.getDepartment(actor, departmentId);
    return this.repo.listProgramsForDepartment(
      actor.institutionId,
      departmentId,
      this.scopeEntityId(actor),
    );
  }

  async createProgram(actor: AuthUser, departmentId: string, dto: CreateProgramDto) {
    await this.getDepartment(actor, departmentId);
    const code = dto.code.trim();
    const dup = await this.repo.findProgramByCode(actor.institutionId, code);
    if (dup) {
      throw new ConflictException('Program code already in use');
    }
    const row = await this.repo.createProgram({
      institutionId: actor.institutionId,
      entityId: actor.entityId,
      departmentId,
      name: dto.name.trim(),
      code,
      type: parseProgramType(dto.type),
      durationYears: dto.durationYears ?? 4,
      creditHours: dto.creditHours ?? 120,
    });
    this.auditAcademic(actor, 'program.create', 'Program', row.id, undefined, {
      code: row.code,
      departmentId,
      entityId: row.entityId,
    } as Prisma.InputJsonValue);
    return row;
  }

  async getProgram(actor: AuthUser, programId: string) {
    const row = await this.repo.findProgram(actor.institutionId, programId, this.scopeEntityId(actor));
    if (!row) {
      throw new NotFoundException('Program not found');
    }
    return row;
  }

  async updateProgram(actor: AuthUser, programId: string, dto: UpdateProgramDto) {
    const existing = await this.repo.findProgram(actor.institutionId, programId, this.scopeEntityId(actor));
    if (!existing) {
      throw new NotFoundException('Program not found');
    }
    if (dto.code !== undefined && dto.code.trim().toLowerCase() !== existing.code.toLowerCase()) {
      const dup = await this.repo.findProgramByCode(actor.institutionId, dto.code.trim());
      if (dup && dup.id !== existing.id) {
        throw new ConflictException('Program code already in use');
      }
    }
    const data: Prisma.ProgramUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = dto.name.trim();
    }
    if (dto.code !== undefined) {
      data.code = dto.code.trim();
    }
    if (dto.type !== undefined) {
      data.type = parseProgramType(dto.type);
    }
    if (dto.durationYears !== undefined) {
      data.durationYears = dto.durationYears;
    }
    if (dto.creditHours !== undefined) {
      data.creditHours = dto.creditHours;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    const updated = await this.repo.updateProgram(existing.id, data);
    this.auditAcademic(actor, 'program.update', 'Program', existing.id, {
      name: existing.name,
      code: existing.code,
    } as Prisma.InputJsonValue, { name: updated.name, code: updated.code } as Prisma.InputJsonValue);
    return updated;
  }

  async removeProgram(actor: AuthUser, programId: string) {
    const existing = await this.repo.findProgram(actor.institutionId, programId, this.scopeEntityId(actor));
    if (!existing) {
      throw new NotFoundException('Program not found');
    }
    const n = await this.repo.softDeleteProgram(actor.institutionId, programId, new Date());
    if (n.count === 0) {
      throw new NotFoundException('Program not found');
    }
    this.auditAcademic(actor, 'program.delete', 'Program', programId, {
      code: existing.code,
    } as Prisma.InputJsonValue, { softDeleted: true } as Prisma.InputJsonValue);
    return { ok: true as const, id: programId };
  }

  // --- Courses ---
  async listCourses(actor: AuthUser, departmentId: string) {
    await this.getDepartment(actor, departmentId);
    return this.repo.listCoursesForDepartment(
      actor.institutionId,
      departmentId,
      this.scopeEntityId(actor),
    );
  }

  async createCourse(actor: AuthUser, departmentId: string, dto: CreateCourseDto) {
    await this.getDepartment(actor, departmentId);
    const code = dto.code.trim();
    const dup = await this.repo.findCourseByCode(actor.institutionId, code);
    if (dup) {
      throw new ConflictException('Course code already in use');
    }
    const row = await this.repo.createCourse({
      institutionId: actor.institutionId,
      entityId: actor.entityId,
      departmentId,
      code,
      title: dto.title.trim(),
      creditHours: dto.creditHours ?? 3,
      description: dto.description?.trim() ?? null,
      prerequisites: (dto.prerequisites ?? []) as Prisma.InputJsonValue,
      syllabus: (dto.syllabus ?? {}) as Prisma.InputJsonValue,
    });
    this.auditAcademic(actor, 'course.create', 'Course', row.id, undefined, {
      code: row.code,
      title: row.title,
      entityId: row.entityId,
    } as Prisma.InputJsonValue);
    return row;
  }

  async getCourse(actor: AuthUser, courseId: string) {
    const row = await this.repo.findCourse(actor.institutionId, courseId, this.scopeEntityId(actor));
    if (!row) {
      throw new NotFoundException('Course not found');
    }
    return row;
  }

  async updateCourse(actor: AuthUser, courseId: string, dto: UpdateCourseDto) {
    const existing = await this.repo.findCourse(actor.institutionId, courseId, this.scopeEntityId(actor));
    if (!existing) {
      throw new NotFoundException('Course not found');
    }
    if (dto.code !== undefined && dto.code.trim().toLowerCase() !== existing.code.toLowerCase()) {
      const dup = await this.repo.findCourseByCode(actor.institutionId, dto.code.trim());
      if (dup && dup.id !== existing.id) {
        throw new ConflictException('Course code already in use');
      }
    }
    const data: Prisma.CourseUpdateInput = {};
    if (dto.code !== undefined) {
      data.code = dto.code.trim();
    }
    if (dto.title !== undefined) {
      data.title = dto.title.trim();
    }
    if (dto.creditHours !== undefined) {
      data.creditHours = dto.creditHours;
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
    }
    if (dto.prerequisites !== undefined) {
      data.prerequisites = dto.prerequisites as Prisma.InputJsonValue;
    }
    if (dto.syllabus !== undefined) {
      data.syllabus = dto.syllabus as Prisma.InputJsonValue;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    const updated = await this.repo.updateCourse(existing.id, data);
    this.auditAcademic(actor, 'course.update', 'Course', existing.id, {
      code: existing.code,
      title: existing.title,
    } as Prisma.InputJsonValue, { code: updated.code, title: updated.title } as Prisma.InputJsonValue);
    return updated;
  }

  async removeCourse(actor: AuthUser, courseId: string) {
    const existing = await this.repo.findCourse(actor.institutionId, courseId, this.scopeEntityId(actor));
    if (!existing) {
      throw new NotFoundException('Course not found');
    }
    const n = await this.repo.softDeleteCourse(actor.institutionId, courseId, new Date());
    if (n.count === 0) {
      throw new NotFoundException('Course not found');
    }
    this.auditAcademic(actor, 'course.delete', 'Course', courseId, {
      code: existing.code,
    } as Prisma.InputJsonValue, { softDeleted: true } as Prisma.InputJsonValue);
    return { ok: true as const, id: courseId };
  }

  // --- Sections ---
  async listSections(actor: AuthUser, semesterId: string, query: ListSectionsQueryDto) {
    await this.getSemester(actor, semesterId);
    return this.repo.listSectionsForSemester(
      actor.institutionId,
      semesterId,
      query.courseId,
      this.scopeEntityId(actor),
    );
  }

  async createSection(actor: AuthUser, dto: CreateSectionDto) {
    const course = await this.repo.findCourse(actor.institutionId, dto.courseId, this.scopeEntityId(actor));
    if (!course) {
      throw new NotFoundException('Course not found');
    }
    const semester = await this.repo.findSemester(actor.institutionId, dto.semesterId);
    if (!semester) {
      throw new NotFoundException('Semester not found');
    }
    await this.assertOptionalUser(actor.institutionId, dto.instructorId ?? undefined);
    const row = await this.repo.createSection({
      institutionId: actor.institutionId,
      entityId: course.entityId,
      courseId: dto.courseId,
      semesterId: dto.semesterId,
      instructorId: dto.instructorId ?? null,
      maxEnrollment: dto.maxEnrollment ?? 30,
      schedule: (dto.schedule ?? {}) as Prisma.InputJsonValue,
      room: dto.room?.trim() ?? null,
      mode: parseSectionMode(dto.mode),
    });
    this.auditAcademic(actor, 'section.create', 'Section', row.id, undefined, {
      courseId: dto.courseId,
      semesterId: dto.semesterId,
      entityId: row.entityId,
    } as Prisma.InputJsonValue);
    return row;
  }

  async getSection(actor: AuthUser, sectionId: string) {
    const row = await this.repo.findSection(actor.institutionId, sectionId, this.scopeEntityId(actor));
    if (!row) {
      throw new NotFoundException('Section not found');
    }
    return row;
  }

  async updateSection(actor: AuthUser, sectionId: string, dto: UpdateSectionDto) {
    const existing = await this.repo.findSection(actor.institutionId, sectionId, this.scopeEntityId(actor));
    if (!existing) {
      throw new NotFoundException('Section not found');
    }
    await this.assertOptionalUser(actor.institutionId, dto.instructorId ?? undefined);
    const data: Prisma.SectionUpdateInput = {};
    if (dto.instructorId !== undefined) {
      data.instructor = dto.instructorId ? { connect: { id: dto.instructorId } } : { disconnect: true };
    }
    if (dto.maxEnrollment !== undefined) {
      data.maxEnrollment = dto.maxEnrollment;
    }
    if (dto.schedule !== undefined) {
      data.schedule = dto.schedule as Prisma.InputJsonValue;
    }
    if (dto.room !== undefined) {
      data.room = dto.room?.trim() ?? null;
    }
    if (dto.mode !== undefined) {
      data.mode = parseSectionMode(dto.mode);
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No fields to update');
    }
    const updated = await this.repo.updateSection(existing.id, data);
    this.auditAcademic(actor, 'section.update', 'Section', existing.id, {
      maxEnrollment: existing.maxEnrollment,
      mode: existing.mode,
    } as Prisma.InputJsonValue, {
      maxEnrollment: updated.maxEnrollment,
      mode: updated.mode,
    } as Prisma.InputJsonValue);
    return updated;
  }

  async removeSection(actor: AuthUser, sectionId: string) {
    const existing = await this.repo.findSection(actor.institutionId, sectionId, this.scopeEntityId(actor));
    if (!existing) {
      throw new NotFoundException('Section not found');
    }
    const n = await this.repo.softDeleteSection(actor.institutionId, sectionId, new Date());
    if (n.count === 0) {
      throw new NotFoundException('Section not found');
    }
    this.auditAcademic(actor, 'section.delete', 'Section', sectionId, {
      courseId: existing.courseId,
      semesterId: existing.semesterId,
    } as Prisma.InputJsonValue, { softDeleted: true } as Prisma.InputJsonValue);
    return { ok: true as const, id: sectionId };
  }
}
