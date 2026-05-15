import { Injectable } from '@nestjs/common';
import type { Prisma, AttendanceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type SectionInstructor = {
  id: string;
  instructorId: string | null;
  institutionId: string;
};

export type AttendanceListRow = Prisma.AttendanceGetPayload<{
  include: {
    student: {
      select: {
        id: true;
        studentNumber: true;
        user: { select: { email: true; profile: true } };
      };
    };
    section: { select: { id: true; courseId: true; course: { select: { code: true; title: true } } } };
    marker: { select: { id: true; email: true } };
  };
}>;

@Injectable()
export class AttendanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  findSection(institutionId: string, sectionId: string): Promise<SectionInstructor | null> {
    return this.prisma.section.findFirst({
      where: { id: sectionId, institutionId, deletedAt: null },
      select: { id: true, instructorId: true, institutionId: true },
    });
  }

  hasActiveEnrollment(institutionId: string, studentId: string, sectionId: string) {
    return this.prisma.studentEnrollment.findFirst({
      where: {
        institutionId,
        studentId,
        sectionId,
        status: 'ENROLLED',
        deletedAt: null,
      },
      select: { id: true },
    });
  }

  findByStudentSectionSession(studentId: string, sectionId: string, sessionDate: Date) {
    return this.prisma.attendance.findFirst({
      where: { studentId, sectionId, sessionDate },
    });
  }

  createAttendance(data: {
    institutionId: string;
    studentId: string;
    sectionId: string;
    sessionDate: Date;
    status: AttendanceStatus;
    markedById: string;
    notes?: string | null;
  }) {
    return this.prisma.attendance.create({
      data: {
        institutionId: data.institutionId,
        studentId: data.studentId,
        sectionId: data.sectionId,
        sessionDate: data.sessionDate,
        status: data.status,
        markedById: data.markedById,
        notes: data.notes ?? null,
      },
      include: {
        student: {
          select: {
            id: true,
            studentNumber: true,
            user: { select: { email: true, profile: true } },
          },
        },
        section: { select: { id: true, courseId: true, course: { select: { code: true, title: true } } } },
        marker: { select: { id: true, email: true } },
      },
    });
  }

  updateAttendance(
    id: string,
    data: { status?: AttendanceStatus; notes?: string | null; markedById?: string; deletedAt?: Date | null },
  ) {
    return this.prisma.attendance.update({
      where: { id },
      data,
      include: {
        student: {
          select: {
            id: true,
            studentNumber: true,
            user: { select: { email: true, profile: true } },
          },
        },
        section: { select: { id: true, courseId: true, course: { select: { code: true, title: true } } } },
        marker: { select: { id: true, email: true } },
      },
    });
  }

  buildListWhere(args: {
    institutionId: string;
    sectionId: string;
    from: Date;
    toExclusive: Date;
    studentId?: string;
  }): Prisma.AttendanceWhereInput {
    const where: Prisma.AttendanceWhereInput = {
      institutionId: args.institutionId,
      sectionId: args.sectionId,
      deletedAt: null,
      sessionDate: { gte: args.from, lt: args.toExclusive },
    };
    if (args.studentId) {
      where.studentId = args.studentId;
    }
    return where;
  }

  findPage(where: Prisma.AttendanceWhereInput, take: number, cursor?: string) {
    return this.prisma.attendance.findMany({
      where,
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ sessionDate: 'desc' }, { student: { studentNumber: 'asc' } }],
      include: {
        student: {
          select: {
            id: true,
            studentNumber: true,
            user: { select: { email: true, profile: true } },
          },
        },
        section: { select: { id: true, courseId: true, course: { select: { code: true, title: true } } } },
        marker: { select: { id: true, email: true } },
      },
    });
  }

  countWhere(where: Prisma.AttendanceWhereInput) {
    return this.prisma.attendance.count({ where });
  }

  findById(institutionId: string, id: string) {
    return this.prisma.attendance.findFirst({
      where: { id, institutionId, deletedAt: null },
      include: {
        student: {
          select: {
            id: true,
            studentNumber: true,
            user: { select: { email: true, profile: true } },
          },
        },
        section: { select: { id: true, courseId: true, course: { select: { code: true, title: true } } } },
        marker: { select: { id: true, email: true } },
      },
    });
  }

  findStudent(institutionId: string, studentId: string) {
    return this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
      select: { id: true, studentNumber: true },
    });
  }

  groupAttendanceByStatusForStudent(institutionId: string, studentId: string) {
    return this.prisma.attendance.groupBy({
      by: ['status'],
      where: { institutionId, studentId, deletedAt: null },
      _count: { id: true },
    });
  }

  groupAttendanceBySectionAndStatusForStudent(institutionId: string, studentId: string) {
    return this.prisma.attendance.groupBy({
      by: ['sectionId', 'status'],
      where: { institutionId, studentId, deletedAt: null },
      _count: { id: true },
    });
  }

  countAttendanceForStudent(institutionId: string, studentId: string) {
    return this.prisma.attendance.count({
      where: { institutionId, studentId, deletedAt: null },
    });
  }
}
