import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PortalRepository {
  constructor(private readonly prisma: PrismaService) {}

  findStudentProfile(institutionId: string, studentId: string) {
    return this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
      select: {
        id: true,
        studentNumber: true,
        enrollmentStatus: true,
        entityId: true,
        userId: true,
        programId: true,
        guardians: true,
        user: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
        program: { select: { id: true, code: true, name: true, creditHours: true } },
        entity: { select: { id: true, code: true, name: true } },
      },
    });
  }

  listStudentsForGuardian(institutionId: string) {
    return this.prisma.student.findMany({
      where: { institutionId, deletedAt: null },
      select: {
        id: true,
        studentNumber: true,
        enrollmentStatus: true,
        guardians: true,
        user: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
        program: { select: { code: true, name: true } },
        entity: { select: { code: true, name: true } },
      },
      orderBy: { studentNumber: 'asc' },
      take: 500,
    });
  }

  findInstitutionAndEntitySettings(institutionId: string, entityId: string) {
    return this.prisma.institution.findFirst({
      where: { id: institutionId, deletedAt: null },
      select: {
        settings: true,
        institutionEntities: {
          where: { id: entityId, deletedAt: null },
          select: { settings: true },
          take: 1,
        },
      },
    });
  }

  listRecentNotifications(userId: string, institutionId: string, take = 8) {
    return this.prisma.userNotification.findMany({
      where: { userId, institutionId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        title: true,
        body: true,
        readAt: true,
        createdAt: true,
        actionUrl: true,
      },
    });
  }

  listStudentDocuments(ownerUserId: string, institutionId: string, take = 50) {
    return this.prisma.document.findMany({
      where: {
        ownerId: ownerUserId,
        institutionId,
        deletedAt: null,
      },
      orderBy: [{ status: 'asc' }, { requestedAt: 'desc' }],
      take,
      select: {
        id: true,
        type: true,
        title: true,
        status: true,
        requestedAt: true,
        issuedAt: true,
        expiresAt: true,
        fileKey: true,
        verificationCode: true,
      },
    });
  }

  listActiveEnrollmentsWithSchedule(institutionId: string, studentId: string) {
    return this.prisma.studentEnrollment.findMany({
      where: {
        institutionId,
        studentId,
        deletedAt: null,
        status: { in: ['ENROLLED', 'COMPLETED'] },
      },
      select: {
        section: {
          select: {
            schedule: true,
            room: true,
            course: { select: { code: true, title: true } },
          },
        },
      },
    });
  }

  listDueAssessmentsForStudent(institutionId: string, studentId: string, horizonDays: number) {
    const now = new Date();
    const horizonEnd = new Date(now.getTime() + horizonDays * 86_400_000);
    return this.prisma.lmsAssessment.findMany({
      where: {
        institutionId,
        deletedAt: null,
        dueDate: { gte: now, lte: horizonEnd },
        courseInstance: {
          section: {
            enrollments: {
              some: {
                studentId,
                deletedAt: null,
                status: { in: ['ENROLLED', 'COMPLETED'] },
              },
            },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 20,
      select: {
        id: true,
        title: true,
        type: true,
        dueDate: true,
        courseInstance: {
          select: {
            id: true,
            section: { select: { course: { select: { code: true, title: true } } } },
          },
        },
      },
    });
  }

  async listOpenAssessmentsForStudent(
    institutionId: string,
    studentId: string,
    assessmentIds: string[],
  ) {
    if (assessmentIds.length === 0) {
      return [];
    }
    const terminal = await this.prisma.lmsSubmission.findMany({
      where: {
        institutionId,
        studentId,
        assessmentId: { in: assessmentIds },
        status: { in: ['SUBMITTED', 'LATE', 'GRADED'] },
      },
      select: { assessmentId: true },
    });
    const done = new Set(terminal.map((t) => t.assessmentId));
    return assessmentIds.filter((id) => !done.has(id));
  }

  attendanceBySectionWithCourses(institutionId: string, studentId: string) {
    return this.prisma.attendance.groupBy({
      by: ['sectionId', 'status'],
      where: { institutionId, studentId, deletedAt: null },
      _count: { id: true },
    });
  }

  findSectionsByIds(institutionId: string, sectionIds: string[]) {
    if (sectionIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.section.findMany({
      where: { institutionId, id: { in: sectionIds }, deletedAt: null },
      select: {
        id: true,
        course: { select: { code: true, title: true } },
      },
    });
  }

  listEnrollmentsWithGrades(institutionId: string, studentId: string) {
    return this.prisma.studentEnrollment.findMany({
      where: { institutionId, studentId, deletedAt: null },
      orderBy: [{ semester: { startDate: 'desc' } }, { createdAt: 'desc' }],
      select: {
        id: true,
        status: true,
        grade: true,
        semester: { select: { id: true, name: true, startDate: true } },
        section: {
          select: {
            course: { select: { code: true, title: true, creditHours: true } },
          },
        },
      },
    });
  }

  listSemesters(institutionId: string) {
    return this.prisma.semester.findMany({
      where: { institutionId, deletedAt: null },
      orderBy: { startDate: 'desc' },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        academicYear: { select: { id: true, name: true } },
      },
      take: 24,
    });
  }

  listOpenSections(institutionId: string, entityId: string, semesterId: string) {
    return this.prisma.section.findMany({
      where: {
        institutionId,
        entityId,
        semesterId,
        deletedAt: null,
      },
      orderBy: [{ course: { code: 'asc' } }],
      select: {
        id: true,
        maxEnrollment: true,
        course: { select: { code: true, title: true } },
        semester: { select: { id: true, name: true } },
        _count: { select: { enrollments: { where: { deletedAt: null, status: 'ENROLLED' } } } },
      },
    });
  }
}
