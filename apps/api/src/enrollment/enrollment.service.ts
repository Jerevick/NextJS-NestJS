import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { ENROLLMENT_CREATED } from '../events/enrollment.events';
import type { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import type { ListEnrollmentsQueryDto } from './dto/list-enrollments-query.dto';
import { EnrollmentHoldsService } from './enrollment-holds.service';
import { EnrollmentRepository, type EnrollmentListRow } from './enrollment.repository';
import { RepeatEnrollmentGuard } from './repeat-enrollment.guard';
import { findTimetableConflicts } from './timetable-conflict.util';

type InstitutionSettings = {
  enrollment?: {
    addDropPeriodDays?: number;
    allowEnrollmentBeforeStartDays?: number;
    /** Institution allows enrolling students into sections outside their campus entity (institution-wide staff only). */
    allowInterEntityEnrollment?: boolean;
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
    } else if (
      item &&
      typeof item === 'object' &&
      'code' in item &&
      typeof (item as { code: unknown }).code === 'string'
    ) {
      codes.push((item as { code: string }).code);
    }
  }
  return codes;
}

@Injectable()
export class EnrollmentService {
  private readonly log = new Logger(EnrollmentService.name);

  constructor(
    private readonly repo: EnrollmentRepository,
    private readonly holds: EnrollmentHoldsService,
    private readonly audit: AuditService,
    private readonly repeatEnrollment: RepeatEnrollmentGuard,
    private readonly events: EventEmitter2,
  ) {}

  private readEnrollmentSettings(settings: unknown): {
    addDropPeriodDays: number;
    allowEnrollmentBeforeStartDays: number;
    allowInterEntityEnrollment: boolean;
  } {
    const s = (settings ?? {}) as InstitutionSettings;
    const e = s.enrollment ?? {};
    return {
      addDropPeriodDays:
        typeof e.addDropPeriodDays === 'number' && e.addDropPeriodDays > 0
          ? e.addDropPeriodDays
          : 21,
      allowEnrollmentBeforeStartDays:
        typeof e.allowEnrollmentBeforeStartDays === 'number' &&
        e.allowEnrollmentBeforeStartDays >= 0
          ? e.allowEnrollmentBeforeStartDays
          : 7,
      allowInterEntityEnrollment: e.allowInterEntityEnrollment === true,
    };
  }

  assertWithinAddDropWindow(
    now: Date,
    semester: { startDate: Date; endDate: Date },
    settings: unknown,
  ) {
    const { addDropPeriodDays, allowEnrollmentBeforeStartDays } =
      this.readEnrollmentSettings(settings);
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

    await this.holds.assertNoActiveHolds(actor.institutionId, dto.studentId);

    const section = await this.repo.findSectionWithCourseSemester(
      actor.institutionId,
      dto.sectionId,
    );
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    if (actor.entityScope === 'ENTITY' && section.entityId !== actor.entityId) {
      throw new NotFoundException('Section not found');
    }

    const inst = await this.repo.getInstitutionSettings(actor.institutionId);
    const enrollmentSettings = this.readEnrollmentSettings(inst?.settings);

    if (section.entityId !== student.entityId) {
      const allowed =
        enrollmentSettings.allowInterEntityEnrollment &&
        actor.entityScope === 'ALL' &&
        dto.allowInterEntity === true;
      if (!allowed) {
        throw new BadRequestException(
          'Section belongs to a different campus entity than this student. Enable inter-entity enrollment in institution settings and pass allowInterEntity, or enroll the student only into sections from their entity.',
        );
      }
    }
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

    await this.assertPrerequisitesMet(
      actor.institutionId,
      dto.studentId,
      section.course.prerequisites,
    );

    await this.assertNoTimetableConflicts(
      actor.institutionId,
      dto.studentId,
      section.semesterId,
      dto.sectionId,
      section.schedule,
    );

    const attempt = dto.enrollmentAttemptNumber ?? 1;
    const originalSemesterId = dto.originalSemesterId?.trim()
      ? dto.originalSemesterId.trim()
      : null;

    await this.repeatEnrollment.assertWithinLimits(actor, dto, student);

    const activeCount = await this.repo.countActiveEnrollmentsInSection(dto.sectionId);
    if (activeCount >= section.maxEnrollment) {
      if (dto.waitlistIfFull) {
        return this.holds.joinWaitlist(actor, dto.sectionId, { studentId: dto.studentId });
      }
      throw new ConflictException('This section is full');
    }

    const existing = await this.repo.findEnrollmentByStudentAndSection(
      dto.studentId,
      dto.sectionId,
    );
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
        this.emitEnrollmentCreated(actor, student, section, revived.id);
        return this.serializeRow(revived);
      }
      throw new ConflictException('An enrollment record already exists for this section');
    }

    const row = await this.repo.createEnrollment({
      studentId: dto.studentId,
      sectionId: dto.sectionId,
      semesterId: section.semesterId,
      institutionId: actor.institutionId,
      originalSemesterId: originalSemesterId ?? undefined,
      enrollmentAttemptNumber: attempt,
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
    this.emitEnrollmentCreated(actor, student, section, row.id);
    return this.serializeRow(row);
  }

  private emitEnrollmentCreated(
    actor: AuthUser,
    student: { id: string; entityId: string; programId: string },
    section: { semesterId: string; course: { code: string } },
    enrollmentId: string,
  ) {
    this.events.emit(ENROLLMENT_CREATED, {
      institutionId: actor.institutionId,
      entityId: student.entityId,
      studentId: student.id,
      programId: student.programId,
      semesterId: section.semesterId,
      courseCode: section.course.code,
      enrollmentId,
      actorUserId: actor.userId,
    });
  }

  async previewTimetableConflicts(actor: AuthUser, studentId: string, sectionId: string) {
    const student = await this.repo.findStudent(actor.institutionId, studentId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    const section = await this.repo.findSectionWithCourseSemester(actor.institutionId, sectionId);
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    const conflicts = await this.loadTimetableConflicts(
      actor.institutionId,
      studentId,
      section.semesterId,
      sectionId,
      section.schedule,
    );
    return { conflicts, hasConflict: conflicts.length > 0 };
  }

  private async loadTimetableConflicts(
    institutionId: string,
    studentId: string,
    semesterId: string,
    candidateSectionId: string,
    candidateSchedule: unknown,
  ) {
    const rows = await this.repo.listActiveStudentEnrollmentsInSemester(
      institutionId,
      studentId,
      semesterId,
      candidateSectionId,
    );
    return findTimetableConflicts(
      rows.map((r) => ({
        sectionId: r.sectionId,
        courseCode: r.section.course.code,
        schedule: r.section.schedule,
      })),
      { sectionId: candidateSectionId, schedule: candidateSchedule },
    );
  }

  private async assertNoTimetableConflicts(
    institutionId: string,
    studentId: string,
    semesterId: string,
    sectionId: string,
    schedule: unknown,
  ): Promise<void> {
    const conflicts = await this.loadTimetableConflicts(
      institutionId,
      studentId,
      semesterId,
      sectionId,
      schedule,
    );
    if (conflicts.length > 0) {
      const first = conflicts[0];
      throw new ConflictException(
        `Timetable conflict with ${first.existingCourseCode} on ${first.day} (${first.existingStart}–${first.existingEnd} overlaps ${first.newStart}–${first.newEnd})`,
      );
    }
  }

  private async assertPrerequisitesMet(
    institutionId: string,
    studentId: string,
    prerequisites: unknown,
  ) {
    const codes = parsePrerequisiteCourseCodes(prerequisites);
    for (const code of codes) {
      const done = await this.repo.hasCompletedPrerequisite(institutionId, studentId, code);
      if (!done) {
        throw new BadRequestException(
          `Prerequisite not satisfied: complete ${code} before enrolling`,
        );
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
      throw new BadRequestException(
        'Enrollment cannot be dropped (wrong status or already dropped)',
      );
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

    await this.promoteWaitlistAfterDrop(actor, row.section.id);

    return { ok: true as const, id };
  }

  private async promoteWaitlistAfterDrop(actor: AuthUser, sectionId: string): Promise<void> {
    const section = await this.repo.findSectionWithCourseSemester(actor.institutionId, sectionId);
    if (!section) {
      return;
    }
    const activeCount = await this.repo.countActiveEnrollmentsInSection(sectionId);
    if (activeCount >= section.maxEnrollment) {
      return;
    }
    const next = await this.holds.findFirstWaiting(sectionId, actor.institutionId);
    if (!next) {
      return;
    }
    try {
      await this.create(actor, { studentId: next.studentId, sectionId });
      await this.holds.markPromoted(next.id, actor.institutionId);
    } catch {
      // Waitlist promotion is best-effort; registrar can enroll manually.
    }
  }

  private serializeRow(row: EnrollmentListRow) {
    return {
      id: row.id,
      status: row.status,
      grade: row.grade,
      enrolledAt: row.enrolledAt,
      originalSemesterId: row.originalSemesterId,
      enrollmentAttemptNumber: row.enrollmentAttemptNumber,
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
