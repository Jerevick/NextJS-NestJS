import { Injectable } from '@nestjs/common';
import type { Prisma, ProgramType, SectionMode, SemesterType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AcademicRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUser(institutionId: string, userId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, institutionId, deletedAt: null },
      select: { id: true },
    });
  }

  // --- Academic years ---
  findYear(institutionId: string, id: string) {
    return this.prisma.academicYear.findFirst({
      where: { id, institutionId, deletedAt: null },
    });
  }

  listYears(institutionId: string, take: number, cursor?: string) {
    return this.prisma.academicYear.findMany({
      where: { institutionId, deletedAt: null },
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
    });
  }

  countYears(institutionId: string) {
    return this.prisma.academicYear.count({ where: { institutionId, deletedAt: null } });
  }

  createYear(data: {
    institutionId: string;
    name: string;
    startDate: Date;
    endDate: Date;
    isCurrent: boolean;
  }) {
    return this.prisma.academicYear.create({ data });
  }

  updateYear(id: string, data: Prisma.AcademicYearUpdateInput) {
    return this.prisma.academicYear.update({ where: { id }, data });
  }

  clearCurrentYearsExcept(institutionId: string, exceptId: string) {
    return this.prisma.academicYear.updateMany({
      where: { institutionId, deletedAt: null, id: { not: exceptId } },
      data: { isCurrent: false },
    });
  }

  softDeleteYear(institutionId: string, id: string, at: Date) {
    return this.prisma.academicYear.updateMany({
      where: { id, institutionId, deletedAt: null },
      data: { deletedAt: at },
    });
  }

  // --- Semesters ---
  findSemester(institutionId: string, id: string) {
    return this.prisma.semester.findFirst({
      where: { id, institutionId, deletedAt: null },
      include: { academicYear: { select: { id: true, name: true } } },
    });
  }

  listSemestersForYear(institutionId: string, academicYearId: string) {
    return this.prisma.semester.findMany({
      where: { institutionId, academicYearId, deletedAt: null },
      orderBy: [{ startDate: 'asc' }, { name: 'asc' }],
    });
  }

  createSemester(data: {
    institutionId: string;
    academicYearId: string;
    name: string;
    startDate: Date;
    endDate: Date;
    type: SemesterType;
  }) {
    return this.prisma.semester.create({ data });
  }

  updateSemester(id: string, data: Prisma.SemesterUpdateInput) {
    return this.prisma.semester.update({ where: { id }, data });
  }

  softDeleteSemester(institutionId: string, id: string, at: Date) {
    return this.prisma.semester.updateMany({
      where: { id, institutionId, deletedAt: null },
      data: { deletedAt: at },
    });
  }

  // --- Divisions ---
  findDivision(institutionId: string, id: string) {
    return this.prisma.academicDivision.findFirst({
      where: { id, institutionId, deletedAt: null },
    });
  }

  findDivisionByCode(institutionId: string, code: string) {
    return this.prisma.academicDivision.findFirst({
      where: { institutionId, code: { equals: code, mode: 'insensitive' }, deletedAt: null },
      select: { id: true },
    });
  }

  listDivisions(institutionId: string, take: number, cursor?: string) {
    return this.prisma.academicDivision.findMany({
      where: { institutionId, deletedAt: null },
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
    });
  }

  countDivisions(institutionId: string) {
    return this.prisma.academicDivision.count({ where: { institutionId, deletedAt: null } });
  }

  createDivision(data: {
    institutionId: string;
    name: string;
    code: string;
    deanId: string | null;
  }) {
    return this.prisma.academicDivision.create({ data });
  }

  updateDivision(id: string, data: Prisma.AcademicDivisionUpdateInput) {
    return this.prisma.academicDivision.update({ where: { id }, data });
  }

  softDeleteDivision(institutionId: string, id: string, at: Date) {
    return this.prisma.academicDivision.updateMany({
      where: { id, institutionId, deletedAt: null },
      data: { deletedAt: at },
    });
  }

  // --- Departments ---
  findDepartment(institutionId: string, id: string) {
    return this.prisma.department.findFirst({
      where: { id, institutionId, deletedAt: null },
      include: { division: { select: { id: true, name: true, code: true } } },
    });
  }

  findDepartmentByCode(institutionId: string, code: string) {
    return this.prisma.department.findFirst({
      where: { institutionId, code: { equals: code, mode: 'insensitive' }, deletedAt: null },
      select: { id: true },
    });
  }

  listDepartmentsForDivision(institutionId: string, divisionId: string) {
    return this.prisma.department.findMany({
      where: { institutionId, divisionId, deletedAt: null },
      orderBy: [{ code: 'asc' }],
      include: { division: { select: { id: true, code: true } } },
    });
  }

  createDepartment(data: {
    institutionId: string;
    divisionId: string;
    name: string;
    code: string;
    headId: string | null;
  }) {
    return this.prisma.department.create({ data });
  }

  updateDepartment(id: string, data: Prisma.DepartmentUpdateInput) {
    return this.prisma.department.update({
      where: { id },
      data,
      include: { division: { select: { id: true, name: true, code: true } } },
    });
  }

  softDeleteDepartment(institutionId: string, id: string, at: Date) {
    return this.prisma.department.updateMany({
      where: { id, institutionId, deletedAt: null },
      data: { deletedAt: at },
    });
  }

  // --- Programs ---
  findProgram(institutionId: string, id: string, scopeEntityId?: string) {
    return this.prisma.program.findFirst({
      where: {
        id,
        institutionId,
        deletedAt: null,
        ...(scopeEntityId ? { entityId: scopeEntityId } : {}),
      },
      include: { department: { select: { id: true, name: true, code: true } } },
    });
  }

  findProgramByCode(institutionId: string, code: string) {
    return this.prisma.program.findFirst({
      where: { institutionId, code: { equals: code, mode: 'insensitive' }, deletedAt: null },
      select: { id: true },
    });
  }

  listProgramsForDepartment(institutionId: string, departmentId: string, scopeEntityId?: string) {
    return this.prisma.program.findMany({
      where: {
        institutionId,
        departmentId,
        deletedAt: null,
        ...(scopeEntityId ? { entityId: scopeEntityId } : {}),
      },
      orderBy: [{ code: 'asc' }],
    });
  }

  listProgramsForInstitution(institutionId: string, scopeEntityId?: string) {
    return this.prisma.program.findMany({
      where: {
        institutionId,
        deletedAt: null,
        ...(scopeEntityId ? { entityId: scopeEntityId } : {}),
      },
      orderBy: [{ code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        department: { select: { code: true, name: true } },
      },
    });
  }

  listSemestersForInstitution(institutionId: string) {
    return this.prisma.semester.findMany({
      where: { institutionId, deletedAt: null },
      orderBy: [{ startDate: 'desc' }],
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        academicYear: { select: { id: true, name: true } },
      },
    });
  }

  createProgram(data: {
    institutionId: string;
    entityId: string;
    departmentId: string;
    name: string;
    code: string;
    type: ProgramType;
    durationYears: number;
    creditHours: number;
  }) {
    return this.prisma.program.create({ data });
  }

  updateProgram(id: string, data: Prisma.ProgramUpdateInput) {
    return this.prisma.program.update({
      where: { id },
      data,
      include: { department: { select: { id: true, name: true, code: true } } },
    });
  }

  softDeleteProgram(institutionId: string, id: string, at: Date) {
    return this.prisma.program.updateMany({
      where: { id, institutionId, deletedAt: null },
      data: { deletedAt: at },
    });
  }

  // --- Courses ---
  findCourse(institutionId: string, id: string, scopeEntityId?: string) {
    return this.prisma.course.findFirst({
      where: {
        id,
        institutionId,
        deletedAt: null,
        ...(scopeEntityId ? { entityId: scopeEntityId } : {}),
      },
      include: { department: { select: { id: true, name: true, code: true } } },
    });
  }

  findCourseByCode(institutionId: string, code: string) {
    return this.prisma.course.findFirst({
      where: { institutionId, code: { equals: code, mode: 'insensitive' }, deletedAt: null },
      select: { id: true },
    });
  }

  listCoursesForDepartment(institutionId: string, departmentId: string, scopeEntityId?: string) {
    return this.prisma.course.findMany({
      where: {
        institutionId,
        departmentId,
        deletedAt: null,
        ...(scopeEntityId ? { entityId: scopeEntityId } : {}),
      },
      orderBy: [{ code: 'asc' }],
    });
  }

  createCourse(data: {
    institutionId: string;
    entityId: string;
    departmentId: string;
    code: string;
    title: string;
    creditHours: number;
    description: string | null;
    prerequisites: Prisma.InputJsonValue;
    syllabus: Prisma.InputJsonValue;
  }) {
    return this.prisma.course.create({ data });
  }

  updateCourse(id: string, data: Prisma.CourseUpdateInput) {
    return this.prisma.course.update({
      where: { id },
      data,
      include: { department: { select: { id: true, name: true, code: true } } },
    });
  }

  softDeleteCourse(institutionId: string, id: string, at: Date) {
    return this.prisma.course.updateMany({
      where: { id, institutionId, deletedAt: null },
      data: { deletedAt: at },
    });
  }

  // --- Sections ---
  findSection(institutionId: string, id: string, scopeEntityId?: string) {
    return this.prisma.section.findFirst({
      where: {
        id,
        institutionId,
        deletedAt: null,
        ...(scopeEntityId ? { entityId: scopeEntityId } : {}),
      },
      include: {
        course: { select: { id: true, code: true, title: true } },
        semester: { select: { id: true, name: true } },
      },
    });
  }

  listSectionsForSemester(institutionId: string, semesterId: string, courseId: string | undefined, scopeEntityId?: string) {
    return this.prisma.section.findMany({
      where: {
        institutionId,
        semesterId,
        deletedAt: null,
        ...(courseId ? { courseId } : {}),
        ...(scopeEntityId ? { entityId: scopeEntityId } : {}),
      },
      orderBy: [{ course: { code: 'asc' } }, { id: 'asc' }],
      include: {
        course: { select: { id: true, code: true, title: true } },
        semester: { select: { id: true, name: true } },
      },
    });
  }

  createSection(data: {
    institutionId: string;
    entityId: string;
    courseId: string;
    semesterId: string;
    instructorId: string | null;
    maxEnrollment: number;
    schedule: Prisma.InputJsonValue;
    room: string | null;
    mode: SectionMode;
  }) {
    return this.prisma.section.create({
      data,
      include: {
        course: { select: { id: true, code: true, title: true } },
        semester: { select: { id: true, name: true } },
      },
    });
  }

  updateSection(id: string, data: Prisma.SectionUpdateInput) {
    return this.prisma.section.update({
      where: { id },
      data,
      include: {
        course: { select: { id: true, code: true, title: true } },
        semester: { select: { id: true, name: true } },
      },
    });
  }

  softDeleteSection(institutionId: string, id: string, at: Date) {
    return this.prisma.section.updateMany({
      where: { id, institutionId, deletedAt: null },
      data: { deletedAt: at },
    });
  }

  // --- Timetables ---
  findTimetable(institutionId: string, id: string) {
    return this.prisma.timetable.findFirst({
      where: { id, institutionId, deletedAt: null },
      include: { semester: { select: { id: true, name: true } } },
    });
  }

  listTimetablesForSemester(institutionId: string, semesterId: string) {
    return this.prisma.timetable.findMany({
      where: { institutionId, semesterId, deletedAt: null },
      orderBy: [{ generatedAt: 'desc' }],
    });
  }

  createTimetable(data: {
    institutionId: string;
    semesterId: string;
    isPublished: boolean;
    data: Prisma.InputJsonValue;
    generatedAt: Date;
  }) {
    return this.prisma.timetable.create({
      data,
      include: { semester: { select: { id: true, name: true } } },
    });
  }

  updateTimetable(id: string, data: Prisma.TimetableUpdateInput) {
    return this.prisma.timetable.update({
      where: { id },
      data,
      include: { semester: { select: { id: true, name: true } } },
    });
  }

  softDeleteTimetable(institutionId: string, id: string, at: Date) {
    return this.prisma.timetable.updateMany({
      where: { id, institutionId, deletedAt: null },
      data: { deletedAt: at },
    });
  }
}
