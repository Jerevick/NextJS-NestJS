import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import type { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import type { ListEnrollmentsQueryDto } from './dto/list-enrollments-query.dto';
import { EnrollmentRepository, type EnrollmentListRow } from './enrollment.repository';

type InstitutionSettings = {
  enrollment?: {
    addDropPeriodDays?: number;
    allowEnrollmentBeforeStartDays?: number;
  };
};

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function parsePrerequisiteCourseCodes(prerequisites: unknown): string[] {
  if (!Array.isArray(prerequisites)) {
    return [];
  }
  const codes: string[] = [];
  for (const item of prerequisites) {
    if (typeof item === 'string') {
      codes.push(item);
    } else if (item && typeof item === 'object' && 'code' in item && typeof (item as { code: unknown }).code === 'string') {
      codes.push((item as { code: string }).code);
    }
  }
  return codes;
}

@Injectable()
export class EnrollmentService {
  constructor(
    private readonly repo: EnrollmentRepository,
    private readonly audit: AuditService,
  ) {}

  private readEnrollmentSettings(settings: unknown): { addDropPeriodDays: number; allowEnrollmentBeforeStartDays: number } {
    const s = (settings ?? {}) as InstitutionSettings;
    const e = s.enrollment ?? {};
    return {
      addDropPeriodDays: typeof e.addDropPeriodDays === 'number' && e.addDropPeriodDays > 0 ? e.addDropPeriodDays : 21,
      allowEnrollmentBeforeStartDays:
        typeof e.allowEnrollmentBeforeStartDays === 'number' && e.allowEnrollmentBeforeStartDays >= 0
          ? e.allowEnrollmentBeforeStartDays
          : 7,
    };
  }

  assertWithinAddDropWindow(
    now: Date,
    semester: { startDate: Date; endDate: Date },
    settings: unknown,
  ) {
    const { addDropPeriodDays, allowEnrollmentBeforeStartDays } = this.readEnrollmentSettings(settings);
    const start = semester.startDate;
    const end = semester.endDate;
    const windowStart = addDays(start, -allowEnrollmentBeforeStartDays);
    const windowEnd = addDays(start, addDropPeriodDays);
    const lastAllowed = end < windowEnd ? end : windowEnd;
    if (now < windowStart) {
      throw new BadRequestException('Enrollment is not open yet for this semester');
    }
    if (now > lastAllowed) {
      throw new BadRequestException('The add/drop period has ended for this semester');
    }
    if (now > end) {
      throw new BadRequestException('This semester has already ended');
    }
  }

  async create(actor: AuthUser, dto: CreateEnrollmentDto) {
    const student = await this.repo.findStudent(actor.institutionId, dto.studentId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (student.enrollmentStatus !== 'ACTIVE') {
      throw new BadRequestException('Student is not in an enrollable status');
    }

    const section = await this.repo.findSectionWithCourseSemester(actor.institutionId, dto.sectionId);
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    if (section.entityId !== student.entityId) {
      throw new BadRequestException('Section belongs to a different campus entity than this student');
    }
    if (actor.entityScope === 'ENTITY' && section.entityId !== actor.entityId) {
      throw new NotFoundException('Section not found');
    }

    const inst = await this.repo.getInstitutionSettings(actor.institutionId);
    const now = new Date();
    this.assertWithinAddDropWindow(now, section.semester, inst?.settings);

    const dupCourse = await this.repo.findActiveEnrollmentSameCourseSemester(
      actor.institutionId,
      dto.studentId,
      section.courseId,
      section.semesterId,
    );
    if (dupCourse) {
      throw new ConflictException('Student is already enrolled in this course for this semester');
    }

    await this.assertPrerequisitesMet(actor.institutionId, dto.studentId, section.course.prerequisites);

    const activeCount = await this.repo.countActiveEnrollmentsInSection(dto.sectionId);
    if (activeCount >= section.maxEnrollment) {
      throw new ConflictException('This section is full');
    }

    const existing = await this.repo.findEnrollmentByStudentAndSection(dto.studentId, dto.sectionId);
    if (existing) {
      if (existing.institutionId !== actor.institutionId) {
        throw new NotFoundException('Section not found');
      }
      if (existing.deletedAt === null && existing.status === 'ENROLLED') {
        throw new ConflictException('Student is already enrolled in this section');
      }
      if (
        existing.deletedAt !== null ||
        existing.status === 'DROPPED' ||
        existing.status === 'WITHDRAWN'
      ) {
        const countAgain = await this.repo.countActiveEnrollmentsInSection(dto.sectionId);
        if (countAgain >= section.maxEnrollment) {
          throw new ConflictException('This section is full');
        }
        const revived = await this.repo.reviveEnrollment(existing.id, actor.institutionId);
        if (!revived) {
          throw new NotFoundException('Enrollment not found');
        }
        this.audit.append({
          institutionId: actor.institutionId,
          actorId: actor.userId,
          action: 'enrollment.revive',
          entity: 'StudentEnrollment',
          entityId: revived.id,
          newValues: {
            studentId: dto.studentId,
            sectionId: dto.sectionId,
            status: revived.status,
          },
        });
        return this.serializeRow(revived);
      }
      throw new ConflictException('An enrollment record already exists for this section');
    }

    const row = await this.repo.createEnrollment({
      studentId: dto.studentId,
      sectionId: dto.sectionId,
      semesterId: section.semesterId,
      institutionId: actor.institutionId,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'enrollment.create',
      entity: 'StudentEnrollment',
      entityId: row.id,
      newValues: {
        studentId: dto.studentId,
        sectionId: dto.sectionId,
        semesterId: section.semesterId,
        status: row.status,
      },
    });
    return this.serializeRow(row);
  }

  private async assertPrerequisitesMet(institutionId: string, studentId: string, prerequisites: unknown) {
    const codes = parsePrerequisiteCourseCodes(prerequisites);
    for (const code of codes) {
      const done = await this.repo.hasCompletedPrerequisite(institutionId, studentId, code);
      if (!done) {
        throw new BadRequestException(`Prerequisite not satisfied: complete ${code} before enrolling`);
      }
    }
  }

  async list(actor: AuthUser, query: ListEnrollmentsQueryDto) {
    const limit = query.limit ?? 20;
    const where = this.repo.buildListWhere({
      institutionId: actor.institutionId,
      studentId: query.studentId,
      sectionId: query.sectionId,
      semesterId: query.semesterId,
      status: query.status,
    });
    const rows = await this.repo.findPage(where, limit, query.cursor);
    let nextCursor: string | undefined;
    if (rows.length > limit) {
      const last = rows.pop();
      nextCursor = last?.id;
    }
    const total = await this.repo.countWhere(where);
    return {
      data: rows.map((r) => this.serializeRow(r)),
      nextCursor,
      total,
    };
  }

  async getById(actor: AuthUser, id: string) {
    const row = await this.repo.findById(actor.institutionId, id);
    if (!row) {
      throw new NotFoundException('Enrollment not found');
    }
    return this.serializeRow(row);
  }

  async drop(actor: AuthUser, id: string) {
    const row = await this.repo.findById(actor.institutionId, id);
    if (!row) {
      throw new NotFoundException('Enrollment not found');
    }
    const inst = await this.repo.getInstitutionSettings(actor.institutionId);
    this.assertWithinAddDropWindow(new Date(), row.semester, inst?.settings);

    const result = await this.repo.softDrop(id, actor.institutionId, new Date());
    if (result.count === 0) {
      throw new BadRequestException('Enrollment cannot be dropped (wrong status or already dropped)');
    }
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'enrollment.drop',
      entity: 'StudentEnrollment',
      entityId: id,
      oldValues: { status: row.status, studentId: row.student.id, sectionId: row.section.id },
      newValues: { softDropped: true },
    });
    return { ok: true as const, id };
  }

  private serializeRow(row: EnrollmentListRow) {
    return {
      id: row.id,
      status: row.status,
      grade: row.grade,
      enrolledAt: row.enrolledAt,
      student: row.student,
      section: {
        id: row.section.id,
        maxEnrollment: row.section.maxEnrollment,
        course: row.section.course,
        semester: row.section.semester,
      },
      semester: row.semester,
    };
  }
}
