import { Injectable } from '@nestjs/common';
import type {
  EnrollmentHoldType,
  Prisma,
  EnrollmentRowStatus,
  WaitlistStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type EnrollmentListRow = Prisma.StudentEnrollmentGetPayload<{
  include: {
    student: {
      select: {
        id: true;
        studentNumber: true;
        user: { select: { email: true; profile: true } };
      };
    };
    section: {
      include: {
        course: {
          select: { id: true; code: true; title: true; creditHours: true; prerequisites: true };
        };
        semester: { select: { id: true; name: true; startDate: true; endDate: true } };
      };
    };
    semester: { select: { id: true; name: true; startDate: true; endDate: true } };
  };
}>;

@Injectable()
export class EnrollmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  getInstitutionSettings(institutionId: string) {
    return this.prisma.institution.findFirst({
      where: { id: institutionId, deletedAt: null },
      select: { settings: true },
    });
  }

  findStudent(institutionId: string, studentId: string) {
    return this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
      select: {
        id: true,
        entityId: true,
        programId: true,
        enrollmentStatus: true,
        admissionDate: true,
        currentLevel: true,
        program: { select: { id: true, durationYears: true } },
      },
    });
  }

  findSectionWithCourseSemester(institutionId: string, sectionId: string) {
    return this.prisma.section.findFirst({
      where: { id: sectionId, institutionId, deletedAt: null },
      include: {
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            prerequisites: true,
            institutionId: true,
            entityId: true,
          },
        },
        semester: { select: { id: true, startDate: true, endDate: true, name: true } },
      },
    });
  }

  listActiveStudentEnrollmentsInSemester(
    institutionId: string,
    studentId: string,
    semesterId: string,
    excludeSectionId?: string,
  ) {
    return this.prisma.studentEnrollment.findMany({
      where: {
        institutionId,
        studentId,
        semesterId,
        status: 'ENROLLED',
        deletedAt: null,
        ...(excludeSectionId ? { sectionId: { not: excludeSectionId } } : {}),
      },
      select: {
        sectionId: true,
        section: {
          select: {
            schedule: true,
            course: { select: { code: true } },
          },
        },
      },
    });
  }

  countActiveEnrollmentsInSection(sectionId: string) {
    return this.prisma.studentEnrollment.count({
      where: {
        sectionId,
        status: 'ENROLLED',
        deletedAt: null,
      },
    });
  }

  findActiveEnrollmentSameCourseSemester(
    institutionId: string,
    studentId: string,
    courseId: string,
    semesterId: string,
  ) {
    return this.prisma.studentEnrollment.findFirst({
      where: {
        institutionId,
        studentId,
        semesterId,
        status: 'ENROLLED',
        deletedAt: null,
        section: { courseId, deletedAt: null },
      },
      select: { id: true },
    });
  }

  findEnrollmentByStudentAndSection(studentId: string, sectionId: string) {
    return this.prisma.studentEnrollment.findFirst({
      where: { studentId, sectionId },
      select: { id: true, status: true, deletedAt: true, institutionId: true },
    });
  }

  hasCompletedPrerequisite(institutionId: string, studentId: string, courseCode: string) {
    return this.prisma.studentEnrollment.findFirst({
      where: {
        studentId,
        institutionId,
        deletedAt: null,
        status: 'COMPLETED',
        section: {
          deletedAt: null,
          course: { code: courseCode, institutionId },
        },
      },
      select: { id: true },
    });
  }

  createEnrollment(data: {
    studentId: string;
    sectionId: string;
    semesterId: string;
    institutionId: string;
    originalSemesterId?: string | null;
    enrollmentAttemptNumber?: number;
  }) {
    return this.prisma.studentEnrollment.create({
      data: {
        studentId: data.studentId,
        sectionId: data.sectionId,
        semesterId: data.semesterId,
        institutionId: data.institutionId,
        status: 'ENROLLED',
        originalSemesterId: data.originalSemesterId ?? undefined,
        enrollmentAttemptNumber: data.enrollmentAttemptNumber ?? 1,
      },
      include: {
        student: {
          select: {
            id: true,
            studentNumber: true,
            user: { select: { email: true, profile: true } },
          },
        },
        section: {
          include: {
            course: {
              select: { id: true, code: true, title: true, creditHours: true, prerequisites: true },
            },
            semester: { select: { id: true, name: true, startDate: true, endDate: true } },
          },
        },
        semester: { select: { id: true, name: true, startDate: true, endDate: true } },
      },
    });
  }

  reviveEnrollment(id: string, institutionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.studentEnrollment.findFirst({
        where: { id, institutionId },
      });
      if (!current) {
        return null;
      }
      return tx.studentEnrollment.update({
        where: { id: current.id },
        data: {
          status: 'ENROLLED',
          deletedAt: null,
          enrolledAt: new Date(),
        },
        include: {
          student: {
            select: {
              id: true,
              studentNumber: true,
              user: { select: { email: true, profile: true } },
            },
          },
          section: {
            include: {
              course: {
                select: {
                  id: true,
                  code: true,
                  title: true,
                  creditHours: true,
                  prerequisites: true,
                },
              },
              semester: { select: { id: true, name: true, startDate: true, endDate: true } },
            },
          },
          semester: { select: { id: true, name: true, startDate: true, endDate: true } },
        },
      });
    });
  }

  buildListWhere(args: {
    institutionId: string;
    studentId?: string;
    sectionId?: string;
    semesterId?: string;
    status?: EnrollmentRowStatus;
  }): Prisma.StudentEnrollmentWhereInput {
    const where: Prisma.StudentEnrollmentWhereInput = {
      institutionId: args.institutionId,
      deletedAt: null,
    };
    if (args.studentId) {
      where.studentId = args.studentId;
    }
    if (args.sectionId) {
      where.sectionId = args.sectionId;
    }
    if (args.semesterId) {
      where.semesterId = args.semesterId;
    }
    if (args.status) {
      where.status = args.status;
    }
    return where;
  }

  findPage(where: Prisma.StudentEnrollmentWhereInput, take: number, cursor?: string) {
    return this.prisma.studentEnrollment.findMany({
      where,
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      include: {
        student: {
          select: {
            id: true,
            studentNumber: true,
            user: { select: { email: true, profile: true } },
          },
        },
        section: {
          include: {
            course: {
              select: { id: true, code: true, title: true, creditHours: true, prerequisites: true },
            },
            semester: { select: { id: true, name: true, startDate: true, endDate: true } },
          },
        },
        semester: { select: { id: true, name: true, startDate: true, endDate: true } },
      },
    });
  }

  countWhere(where: Prisma.StudentEnrollmentWhereInput) {
    return this.prisma.studentEnrollment.count({ where });
  }

  findById(institutionId: string, id: string) {
    return this.prisma.studentEnrollment.findFirst({
      where: { id, institutionId, deletedAt: null },
      include: {
        student: {
          select: {
            id: true,
            studentNumber: true,
            user: { select: { email: true, profile: true } },
          },
        },
        section: {
          include: {
            course: {
              select: { id: true, code: true, title: true, creditHours: true, prerequisites: true },
            },
            semester: { select: { id: true, name: true, startDate: true, endDate: true } },
          },
        },
        semester: { select: { id: true, name: true, startDate: true, endDate: true } },
      },
    });
  }

  softDrop(id: string, institutionId: string, at: Date) {
    return this.prisma.studentEnrollment.updateMany({
      where: {
        id,
        institutionId,
        deletedAt: null,
        status: 'ENROLLED',
      },
      data: {
        status: 'DROPPED',
        deletedAt: at,
      },
    });
  }

  countActiveHolds(institutionId: string, studentId: string) {
    return this.prisma.enrollmentHold.count({
      where: {
        institutionId,
        studentId,
        liftedAt: null,
        deletedAt: null,
      },
    });
  }

  listHoldsForStudent(institutionId: string, studentId: string, activeOnly: boolean) {
    return this.prisma.enrollmentHold.findMany({
      where: {
        institutionId,
        studentId,
        deletedAt: null,
        ...(activeOnly ? { liftedAt: null } : {}),
      },
      orderBy: { placedAt: 'desc' },
      include: {
        placedBy: { select: { id: true, email: true, profile: true } },
        liftedBy: { select: { id: true, email: true, profile: true } },
      },
    });
  }

  findHoldById(institutionId: string, id: string) {
    return this.prisma.enrollmentHold.findFirst({
      where: { id, institutionId, deletedAt: null },
    });
  }

  createHold(data: {
    studentId: string;
    institutionId: string;
    entityId: string;
    type: EnrollmentHoldType;
    reason: string;
    placedById: string;
  }) {
    return this.prisma.enrollmentHold.create({
      data: {
        studentId: data.studentId,
        institutionId: data.institutionId,
        entityId: data.entityId,
        type: data.type,
        reason: data.reason,
        placedById: data.placedById,
      },
      include: {
        placedBy: { select: { id: true, email: true, profile: true } },
        liftedBy: { select: { id: true, email: true, profile: true } },
      },
    });
  }

  liftHold(id: string, institutionId: string, liftedById: string, liftNotes: string | null) {
    return this.prisma.enrollmentHold.updateMany({
      where: {
        id,
        institutionId,
        liftedAt: null,
        deletedAt: null,
      },
      data: {
        liftedAt: new Date(),
        liftedById,
        liftNotes,
      },
    });
  }

  findWaitlistEntry(institutionId: string, studentId: string, sectionId: string) {
    return this.prisma.sectionWaitlistEntry.findFirst({
      where: { institutionId, studentId, sectionId, deletedAt: null },
    });
  }

  maxWaitlistPosition(sectionId: string) {
    return this.prisma.sectionWaitlistEntry.aggregate({
      where: { sectionId, status: 'WAITING', deletedAt: null },
      _max: { position: true },
    });
  }

  createWaitlistEntry(data: {
    studentId: string;
    sectionId: string;
    semesterId: string;
    institutionId: string;
    position: number;
  }) {
    return this.prisma.sectionWaitlistEntry.create({
      data: {
        studentId: data.studentId,
        sectionId: data.sectionId,
        semesterId: data.semesterId,
        institutionId: data.institutionId,
        position: data.position,
        status: 'WAITING',
      },
      include: {
        student: {
          select: {
            id: true,
            studentNumber: true,
            user: { select: { email: true, profile: true } },
          },
        },
        section: {
          include: {
            course: { select: { code: true, title: true } },
          },
        },
      },
    });
  }

  listSectionWaitlist(institutionId: string, sectionId: string, status?: WaitlistStatus) {
    return this.prisma.sectionWaitlistEntry.findMany({
      where: {
        institutionId,
        sectionId,
        deletedAt: null,
        ...(status ? { status } : {}),
      },
      orderBy: [{ status: 'asc' }, { position: 'asc' }],
      include: {
        student: {
          select: {
            id: true,
            studentNumber: true,
            user: { select: { email: true, profile: true } },
          },
        },
      },
    });
  }

  findFirstWaiting(sectionId: string, institutionId: string) {
    return this.prisma.sectionWaitlistEntry.findFirst({
      where: {
        sectionId,
        institutionId,
        status: 'WAITING',
        deletedAt: null,
      },
      orderBy: { position: 'asc' },
    });
  }

  markWaitlistPromoted(id: string, institutionId: string) {
    return this.prisma.sectionWaitlistEntry.updateMany({
      where: { id, institutionId, status: 'WAITING', deletedAt: null },
      data: { status: 'PROMOTED', promotedAt: new Date() },
    });
  }

  removeWaitlistEntry(id: string, institutionId: string) {
    return this.prisma.sectionWaitlistEntry.updateMany({
      where: { id, institutionId, status: 'WAITING', deletedAt: null },
      data: { status: 'REMOVED', deletedAt: new Date() },
    });
  }
}
