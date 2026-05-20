import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { AttendanceService } from '../attendance/attendance.service';
import { DocumentsService } from '../documents/documents.service';
import { FinanceService } from '../finance/finance.service';
import { isGuardianLinkedToStudent } from '../finance/finance-guardian-access.util';
import { LmsService } from '../lms/lms.service';
import { ProgressionService } from '../progression/progression.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import type { CreateEnrollmentDto } from '../enrollment/dto/create-enrollment.dto';
import {
  assertGuardianLinked,
  assertPortalGuardian,
  assertPortalStudent,
  assertStudentWritable,
} from './portal-access.util';
import { resolveGuardianPortalVisibility } from './guardian-portal-settings.util';
import { PortalAcademicTipService } from './portal-academic-tip.service';
import { buildGpaTrend } from './portal-gpa-trend.util';
import { buildTodaySchedule } from './portal-timetable.util';
import type { RequestStudentDocumentDto } from './dto/request-student-document.dto';
import { PortalRepository } from './portal.repository';

function displayName(profile: unknown, email: string): string {
  if (profile && typeof profile === 'object') {
    const p = profile as Record<string, unknown>;
    const first = typeof p.firstName === 'string' ? p.firstName : '';
    const last = typeof p.lastName === 'string' ? p.lastName : '';
    const name = [first, last].filter(Boolean).join(' ').trim();
    if (name) {
      return name;
    }
  }
  return email;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) {
    return 'Good morning';
  }
  if (h < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

@Injectable()
export class PortalService {
  constructor(
    private readonly repo: PortalRepository,
    private readonly attendance: AttendanceService,
    private readonly finance: FinanceService,
    private readonly lms: LmsService,
    private readonly progression: ProgressionService,
    private readonly enrollment: EnrollmentService,
    private readonly documents: DocumentsService,
    private readonly academicTips: PortalAcademicTipService,
  ) {}

  async getStudentProfile(actor: AuthUser) {
    const studentId = assertPortalStudent(actor);
    const row = await this.repo.findStudentProfile(actor.institutionId, studentId);
    if (!row) {
      throw new NotFoundException('Student not found');
    }
    if (!row.user) {
      throw new NotFoundException('Student user account not found');
    }
    return {
      studentId: row.id,
      studentNumber: row.studentNumber,
      enrollmentStatus: row.enrollmentStatus,
      readOnly: row.enrollmentStatus !== 'ACTIVE',
      email: row.user.email,
      displayName: displayName(row.user.profile, row.user.email),
      program: row.program,
      entity: row.entity,
    };
  }

  async getStudentDashboard(actor: AuthUser) {
    const studentId = assertPortalStudent(actor);
    const profile = await this.getStudentProfile(actor);
    const profileRow = await this.repo.findStudentProfile(actor.institutionId, studentId);
    const programCredits = profileRow?.program?.creditHours ?? 120;

    const [gpa, courses, notifications, scheduleEnrollments, dueAssessments, attendanceRaw] =
      await Promise.all([
        this.progression.getStudentGpaBreakdown(actor, studentId).catch(() => null),
        this.lms
          .listCourseInstances(actor, { limit: 12, includeStudentSnapshot: true })
          .catch(() => ({ data: [] as Array<Record<string, unknown>> })),
        this.repo.listRecentNotifications(actor.userId, actor.institutionId),
        this.repo.listActiveEnrollmentsWithSchedule(actor.institutionId, studentId),
        this.listOpenDueAssessments(actor, studentId),
        this.attendance.studentSummary(actor, studentId).catch(() => null),
      ]);

    const todaySchedule = buildTodaySchedule(scheduleEnrollments);
    const lowestAttendance = attendanceRaw
      ? await this.lowestAttendanceCourse(actor.institutionId, attendanceRaw)
      : undefined;
    const tipResult = await this.academicTips.buildStudentTip(actor, {
      lowestAttendance,
      dueSoonCount: dueAssessments.length,
      cgpa: gpa?.cumulativeGpa ?? null,
    });

    const courseRows = courses.data as Array<{
      id: string;
      course: { code: string; title: string };
      studentSnapshot?: {
        progressPercent: number;
        lastAccessedAt: string | null;
        dueSoonCount: number;
        continueLessonId: string | null;
      };
    }>;

    let continueLearning: {
      courseInstanceId: string;
      courseCode: string;
      courseTitle: string;
      progressPercent: number;
      lessonId: string | null;
    } | null = null;

    const sorted = [...courseRows].sort((a, b) => {
      const ta = a.studentSnapshot?.lastAccessedAt ?? '';
      const tb = b.studentSnapshot?.lastAccessedAt ?? '';
      return tb.localeCompare(ta);
    });
    const top = sorted[0];
    if (top) {
      continueLearning = {
        courseInstanceId: top.id,
        courseCode: top.course.code,
        courseTitle: top.course.title,
        progressPercent: top.studentSnapshot?.progressPercent ?? 0,
        lessonId: top.studentSnapshot?.continueLessonId ?? null,
      };
    }

    const dueSoon = courseRows
      .filter((c) => (c.studentSnapshot?.dueSoonCount ?? 0) > 0)
      .map((c) => ({
        courseInstanceId: c.id,
        courseCode: c.course.code,
        courseTitle: c.course.title,
        dueCount: c.studentSnapshot?.dueSoonCount ?? 0,
      }))
      .sort((a, b) => b.dueCount - a.dueCount);

    return {
      greeting: greeting(),
      profile,
      cgpa: gpa?.cumulativeGpa ?? null,
      creditHoursGraded: gpa?.creditHoursGradedUsed ?? 0,
      creditProgress: {
        completed: gpa?.creditHoursGradedUsed ?? 0,
        required: programCredits,
      },
      continueLearning,
      dueSoon,
      dueAssessments,
      todaySchedule,
      academicTip: tipResult.tip,
      academicTipSource: tipResult.source,
      announcements: notifications.map((n: (typeof notifications)[number]) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
        actionUrl: n.actionUrl,
      })),
    };
  }

  async getStudentLmsCourses(
    actor: AuthUser,
    query: { limit?: number; includeStudentSnapshot?: boolean },
  ) {
    assertPortalStudent(actor);
    return this.lms.listCourseInstances(actor, {
      limit: query.limit ?? 48,
      includeStudentSnapshot: query.includeStudentSnapshot ?? true,
    });
  }

  async getStudentExcessCredit(actor: AuthUser) {
    const studentId = assertPortalStudent(actor);
    return this.finance.getExcessCreditSummary(actor, studentId);
  }

  async requestStudentDocument(actor: AuthUser, dto: RequestStudentDocumentDto) {
    const studentId = assertPortalStudent(actor);
    const student = await this.repo.findStudentProfile(actor.institutionId, studentId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    assertStudentWritable(student.enrollmentStatus);
    if (!student.userId) {
      throw new NotFoundException('Student user account not linked');
    }
    const title = dto.title?.trim() || `${dto.type.replace(/_/g, ' ')} request`;
    return this.documents.create(actor, {
      ownerId: student.userId,
      type: dto.type,
      title,
    });
  }

  async getStudentGrades(actor: AuthUser) {
    const studentId = assertPortalStudent(actor);
    const [gpa, enrollments] = await Promise.all([
      this.progression.getStudentGpaBreakdown(actor, studentId),
      this.repo.listEnrollmentsWithGrades(actor.institutionId, studentId),
    ]);

    const bySemester = new Map<
      string,
      {
        semesterId: string;
        semesterName: string;
        startDate: Date;
        courses: Array<{
          enrollmentId: string;
          courseCode: string;
          courseTitle: string;
          creditHours: number;
          grade: unknown;
          status: string;
        }>;
      }
    >();

    for (const e of enrollments) {
      const semId = e.semester?.id ?? '_unknown';
      const semName = e.semester?.name ?? 'Unknown semester';
      const startDate = e.semester?.startDate ?? new Date(0);
      if (!bySemester.has(semId)) {
        bySemester.set(semId, {
          semesterId: semId,
          semesterName: semName,
          startDate,
          courses: [],
        });
      }
      bySemester.get(semId)!.courses.push({
        enrollmentId: e.id,
        courseCode: e.section.course.code,
        courseTitle: e.section.course.title,
        creditHours: e.section.course.creditHours,
        grade: e.grade,
        status: e.status,
      });
    }

    const semesterList = [...bySemester.values()];
    const gpaTrend = buildGpaTrend(semesterList);

    return {
      cumulativeGpa: gpa.cumulativeGpa,
      creditHoursGradedUsed: gpa.creditHoursGradedUsed,
      policy: gpa.policy,
      gpaTrend,
      semesters: semesterList.map(({ startDate: _sd, ...rest }) => rest),
    };
  }

  async getStudentAttendance(actor: AuthUser) {
    const studentId = assertPortalStudent(actor);
    const summary = await this.attendance.studentSummary(actor, studentId);
    return this.enrichAttendanceSections(actor.institutionId, summary);
  }

  async getStudentDocuments(actor: AuthUser) {
    const studentId = assertPortalStudent(actor);
    const student = await this.repo.findStudentProfile(actor.institutionId, studentId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    if (!student.userId) {
      throw new NotFoundException('Student user account not linked');
    }
    const docs = await this.repo.listStudentDocuments(student.userId, actor.institutionId);
    const issuedStatuses = new Set(['ISSUED', 'READY']);
    const rows = docs.map((d) => ({
      id: d.id,
      type: d.type,
      title: d.title,
      status: d.status,
      requestedAt: d.requestedAt?.toISOString() ?? null,
      issuedAt: d.issuedAt?.toISOString() ?? null,
      expiresAt: d.expiresAt?.toISOString() ?? null,
      hasFile: Boolean(d.fileKey),
      verificationCode: d.verificationCode,
      downloadable: issuedStatuses.has(d.status) && Boolean(d.fileKey),
    }));
    return {
      data: rows,
      issued: rows.filter((r) => issuedStatuses.has(r.status)),
      pending: rows.filter((r) => !issuedStatuses.has(r.status)),
    };
  }

  async getStudentFinance(actor: AuthUser) {
    const studentId = assertPortalStudent(actor);
    return this.finance.getStudentAccount(actor, studentId);
  }

  async getRegistrationCatalog(actor: AuthUser, semesterId?: string) {
    const studentId = assertPortalStudent(actor);
    const student = await this.repo.findStudentProfile(actor.institutionId, studentId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    assertStudentWritable(student.enrollmentStatus);

    const semesters = await this.repo.listSemesters(actor.institutionId);
    const activeSemesterId = semesterId?.trim() || semesters[0]?.id;
    const sections = activeSemesterId
      ? await this.repo.listOpenSections(actor.institutionId, student.entityId, activeSemesterId)
      : [];

    return {
      readOnly: false,
      semesters,
      activeSemesterId: activeSemesterId ?? null,
      sections: sections.map((s) => ({
        id: s.id,
        maxEnrollment: s.maxEnrollment,
        enrolledCount: s._count.enrollments,
        course: s.course,
        semester: s.semester,
      })),
    };
  }

  async enrollSelf(actor: AuthUser, dto: CreateEnrollmentDto) {
    const studentId = assertPortalStudent(actor);
    if (dto.studentId !== studentId) {
      throw new ForbiddenException('You may only enroll yourself');
    }
    const student = await this.repo.findStudentProfile(actor.institutionId, studentId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    assertStudentWritable(student.enrollmentStatus);
    return this.enrollment.create(actor, dto);
  }

  async listGuardianStudents(actor: AuthUser) {
    assertPortalGuardian(actor);
    const rows = await this.repo.listStudentsForGuardian(actor.institutionId);
    const linked = rows.filter((s) =>
      isGuardianLinkedToStudent(s.guardians, actor.userId, actor.email),
    );

    const visibility = await this.guardianVisibility(actor);

    const summaries = await Promise.all(
      linked.map(async (s) => {
        let balance: number | null = null;
        let cgpa: number | null = null;
        if (visibility.finance) {
          try {
            const acct = await this.finance.getStudentAccount(actor, s.id);
            balance = acct.account?.balance ?? null;
          } catch {
            balance = null;
          }
        }
        if (visibility.academic) {
          try {
            const gpa = await this.progression.getStudentGpaBreakdown(actor, s.id);
            cgpa = gpa.cumulativeGpa;
          } catch {
            cgpa = null;
          }
        }
        return {
          studentId: s.id,
          studentNumber: s.studentNumber,
          enrollmentStatus: s.enrollmentStatus,
          displayName: displayName(s.user?.profile, s.user?.email ?? ''),
          program: s.program,
          entity: s.entity,
          cgpa,
          balance,
          alerts: {
            outstandingBalance: balance != null && balance > 0,
            inactive: s.enrollmentStatus !== 'ACTIVE',
          },
        };
      }),
    );

    return {
      visibility,
      summary: {
        totalStudents: summaries.length,
        outstandingBalanceCount: summaries.filter((s) => s.alerts.outstandingBalance).length,
        inactiveCount: summaries.filter((s) => s.alerts.inactive).length,
        onTrackCount: summaries.filter((s) => !s.alerts.outstandingBalance && !s.alerts.inactive)
          .length,
      },
      students: summaries,
    };
  }

  async getGuardianStudent(actor: AuthUser, studentId: string) {
    assertPortalGuardian(actor);
    const student = await this.repo.findStudentProfile(actor.institutionId, studentId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    assertGuardianLinked(student.guardians, actor, studentId);

    const visibility = await this.guardianVisibility(actor, student.entityId);
    let balance: number | null = null;
    let cgpa: number | null = null;
    if (visibility.finance) {
      try {
        const acct = await this.finance.getStudentAccount(actor, studentId);
        balance = acct.account?.balance ?? null;
      } catch {
        balance = null;
      }
    }
    if (visibility.academic) {
      try {
        const gpa = await this.progression.getStudentGpaBreakdown(actor, studentId);
        cgpa = gpa.cumulativeGpa;
      } catch {
        cgpa = null;
      }
    }

    return {
      visibility,
      student: {
        studentId: student.id,
        studentNumber: student.studentNumber,
        enrollmentStatus: student.enrollmentStatus,
        displayName: displayName(student.user?.profile, student.user?.email ?? ''),
        program: student.program,
        entity: student.entity,
        cgpa,
        balance,
      },
    };
  }

  async getGuardianStudentAcademic(actor: AuthUser, studentId: string) {
    await this.assertGuardianStudent(actor, studentId);
    const visibility = await this.guardianVisibility(actor);
    if (!visibility.academic) {
      throw new ForbiddenException(
        'Academic records are not visible to guardians at this institution',
      );
    }
    return this.getStudentGradesForId(actor, studentId);
  }

  async getGuardianStudentAttendance(actor: AuthUser, studentId: string) {
    await this.assertGuardianStudent(actor, studentId);
    const visibility = await this.guardianVisibility(actor);
    if (!visibility.attendance) {
      throw new ForbiddenException('Attendance is not visible to guardians at this institution');
    }
    const summary = await this.attendance.studentSummary(actor, studentId);
    return this.enrichAttendanceSections(actor.institutionId, summary);
  }

  async getGuardianStudentFinance(actor: AuthUser, studentId: string) {
    await this.assertGuardianStudent(actor, studentId);
    const visibility = await this.guardianVisibility(actor);
    if (!visibility.finance) {
      throw new ForbiddenException('Finance is not visible to guardians at this institution');
    }
    return this.finance.getStudentAccount(actor, studentId);
  }

  private async getStudentGradesForId(actor: AuthUser, studentId: string) {
    const [gpa, enrollments] = await Promise.all([
      this.progression.getStudentGpaBreakdown(actor, studentId),
      this.repo.listEnrollmentsWithGrades(actor.institutionId, studentId),
    ]);
    return {
      cumulativeGpa: gpa.cumulativeGpa,
      creditHoursGradedUsed: gpa.creditHoursGradedUsed,
      enrollments: enrollments
        .filter((e) => e.grade != null)
        .map((e) => ({
          courseCode: e.section.course.code,
          courseTitle: e.section.course.title,
          grade: e.grade,
          semesterName: e.semester?.name ?? null,
        })),
    };
  }

  private async assertGuardianStudent(actor: AuthUser, studentId: string) {
    assertPortalGuardian(actor);
    const guardians = await this.loadGuardians(studentId, actor.institutionId);
    assertGuardianLinked(guardians, actor, studentId);
  }

  private async loadGuardians(studentId: string, institutionId: string) {
    const row = await this.repo.findStudentProfile(institutionId, studentId);
    if (!row) {
      throw new NotFoundException('Student not found');
    }
    return row.guardians;
  }

  private async listOpenDueAssessments(actor: AuthUser, studentId: string) {
    const rows = await this.repo.listDueAssessmentsForStudent(actor.institutionId, studentId, 7);
    const openIds = new Set(
      await this.repo.listOpenAssessmentsForStudent(
        actor.institutionId,
        studentId,
        rows.map((r) => r.id),
      ),
    );
    return rows
      .filter((r) => openIds.has(r.id) && r.dueDate != null)
      .map((r) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        dueDate: r.dueDate!.toISOString(),
        courseCode: r.courseInstance.section.course.code,
        courseTitle: r.courseInstance.section.course.title,
        courseInstanceId: r.courseInstance.id,
      }));
  }

  private async lowestAttendanceCourse(
    institutionId: string,
    summary: {
      bySection: Array<{ sectionId: string; total: number; counts: Record<string, number> }>;
    },
  ) {
    const enriched = await this.enrichAttendanceSections(institutionId, summary);
    let worst: { courseCode: string; ratePercent: number } | undefined;
    for (const sec of enriched.bySection) {
      const courseCode =
        'courseCode' in sec && typeof sec.courseCode === 'string' ? sec.courseCode : null;
      if (sec.total < 4 || !courseCode) {
        continue;
      }
      const present = sec.counts.PRESENT ?? 0;
      const ratePercent = (present / sec.total) * 100;
      if (!worst || ratePercent < worst.ratePercent) {
        worst = { courseCode, ratePercent };
      }
    }
    return worst;
  }

  private async enrichAttendanceSections<
    T extends {
      bySection: Array<{
        sectionId: string;
        total: number;
        counts: Record<string, number>;
      }>;
    },
  >(institutionId: string, summary: T): Promise<T> {
    const sectionIds = summary.bySection.map((s) => s.sectionId);
    const sections = await this.repo.findSectionsByIds(institutionId, sectionIds);
    const byId = new Map(sections.map((s) => [s.id, s]));
    return {
      ...summary,
      bySection: summary.bySection.map((sec) => {
        const meta = byId.get(sec.sectionId);
        return {
          ...sec,
          courseCode: meta?.course.code ?? null,
          courseTitle: meta?.course.title ?? null,
        };
      }),
    };
  }

  private async guardianVisibility(actor: AuthUser, entityId?: string) {
    const inst = await this.repo.findInstitutionAndEntitySettings(
      actor.institutionId,
      entityId ?? actor.entityId,
    );
    const entitySettings = inst?.institutionEntities[0]?.settings;
    return resolveGuardianPortalVisibility(inst?.settings, entitySettings);
  }
}
