import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type SectionInstructor = {
  id: string;
  instructorId: string | null;
  institutionId: string;
  courseId: string;
  semesterId: string;
};

@Injectable()
export class GradesRepository {
  constructor(private readonly prisma: PrismaService) {}

  getInstitutionSettings(institutionId: string) {
    return this.prisma.institution.findFirst({
      where: { id: institutionId, deletedAt: null },
      select: { settings: true },
    });
  }

  /** Deep-merge `grades` slice into `Institution.settings` without dropping other roots (enrollment, etc.). */
  mergeInstitutionGradesSetting(institutionId: string, gradesPatch: Record<string, unknown>) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.institution.findFirst({
        where: { id: institutionId, deletedAt: null },
        select: { settings: true },
      });
      if (!row) {
        return null;
      }
      const top =
        row.settings !== null && typeof row.settings === 'object' && !Array.isArray(row.settings)
          ? ({ ...(row.settings as Record<string, unknown>) } as Record<string, unknown>)
          : {};
      const gradesPrev =
        top.grades !== null && typeof top.grades === 'object' && !Array.isArray(top.grades)
          ? ({ ...(top.grades as Record<string, unknown>) } as Record<string, unknown>)
          : {};
      const mergedGrades = { ...gradesPrev, ...gradesPatch };
      top.grades = mergedGrades as Prisma.JsonValue;

      await tx.institution.update({
        where: { id: institutionId },
        data: { settings: top as Prisma.InputJsonValue },
      });
      return row;
    });
  }

  findSection(institutionId: string, sectionId: string): Promise<SectionInstructor | null> {
    return this.prisma.section.findFirst({
      where: { id: sectionId, institutionId, deletedAt: null },
      select: {
        id: true,
        instructorId: true,
        institutionId: true,
        courseId: true,
        semesterId: true,
      },
    });
  }

  findEnrollmentsForSection(institutionId: string, sectionId: string) {
    return this.prisma.studentEnrollment.findMany({
      where: {
        institutionId,
        sectionId,
        deletedAt: null,
        status: 'ENROLLED',
      },
      orderBy: { student: { studentNumber: 'asc' } },
      include: {
        student: {
          select: {
            id: true,
            studentNumber: true,
            user: { select: { email: true, profile: true } },
          },
        },
        section: {
          select: {
            id: true,
            instructorId: true,
            courseId: true,
            semesterId: true,
            course: { select: { code: true, title: true, creditHours: true } },
          },
        },
      },
    });
  }

  findEnrollmentWithSection(institutionId: string, enrollmentId: string) {
    return this.prisma.studentEnrollment.findFirst({
      where: { id: enrollmentId, institutionId, deletedAt: null },
      include: {
        student: {
          select: {
            id: true,
            userId: true,
            studentNumber: true,
            entityId: true,
            user: { select: { email: true, profile: true } },
          },
        },
        section: {
          select: {
            id: true,
            entityId: true,
            instructorId: true,
            courseId: true,
            semesterId: true,
            course: { select: { code: true, title: true, creditHours: true } },
          },
        },
      },
    });
  }

  updateEnrollmentGrade(enrollmentId: string, grade: Prisma.InputJsonValue) {
    return this.prisma.studentEnrollment.update({
      where: { id: enrollmentId },
      data: { grade },
      include: {
        student: {
          select: {
            id: true,
            studentNumber: true,
            user: { select: { email: true, profile: true } },
          },
        },
        section: {
          select: {
            id: true,
            instructorId: true,
            courseId: true,
            semesterId: true,
            course: { select: { code: true, title: true, creditHours: true } },
          },
        },
      },
    });
  }

  listGradingScales(institutionId: string) {
    return this.prisma.gradingScale.findMany({
      where: { institutionId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  findGradingScale(institutionId: string, id: string) {
    return this.prisma.gradingScale.findFirst({
      where: { id, institutionId, deletedAt: null },
    });
  }

  findDefaultGradingScale(institutionId: string) {
    return this.prisma.gradingScale.findFirst({
      where: { institutionId, isDefault: true, deletedAt: null },
    });
  }

  findFirstGradingScale(institutionId: string) {
    return this.prisma.gradingScale.findFirst({
      where: { institutionId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  createGradingScale(data: {
    institutionId: string;
    name: string;
    isDefault: boolean;
    scale: Prisma.InputJsonValue;
  }) {
    return this.prisma.gradingScale.create({ data });
  }

  updateGradingScale(id: string, data: Prisma.GradingScaleUpdateInput) {
    return this.prisma.gradingScale.update({
      where: { id },
      data,
    });
  }

  clearDefaultFlagsExcept(institutionId: string, exceptId: string) {
    return this.prisma.gradingScale.updateMany({
      where: { institutionId, deletedAt: null, id: { not: exceptId } },
      data: { isDefault: false },
    });
  }

  setDefault(id: string) {
    return this.prisma.gradingScale.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  softDeleteGradingScale(institutionId: string, id: string, at: Date) {
    return this.prisma.gradingScale.updateMany({
      where: { id, institutionId, deletedAt: null },
      data: { deletedAt: at, isDefault: false },
    });
  }

  createGradeOverride(data: {
    institutionId: string;
    enrollmentId: string;
    requestedById: string;
    reason: string;
    oldGrade: Prisma.InputJsonValue | typeof Prisma.JsonNull;
    newGrade: Prisma.InputJsonValue;
  }) {
    return this.prisma.gradeOverride.create({
      data: {
        institutionId: data.institutionId,
        enrollmentId: data.enrollmentId,
        requestedById: data.requestedById,
        reason: data.reason,
        oldGrade: data.oldGrade,
        newGrade: data.newGrade,
      },
      include: {
        requester: { select: { id: true, email: true } },
        enrollment: {
          select: {
            id: true,
            grade: true,
            student: {
              select: {
                id: true,
                studentNumber: true,
                user: { select: { email: true, profile: true } },
              },
            },
            section: {
              select: {
                id: true,
                course: { select: { code: true, title: true } },
              },
            },
          },
        },
      },
    });
  }

  buildPendingOverridesWhere(institutionId: string): Prisma.GradeOverrideWhereInput {
    return {
      institutionId,
      deletedAt: null,
      approvedById: null,
    };
  }

  findPendingOverridesPage(institutionId: string, take: number, cursor?: string) {
    const where = this.buildPendingOverridesWhere(institutionId);
    return this.prisma.gradeOverride.findMany({
      where,
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        requester: { select: { id: true, email: true } },
        enrollment: {
          select: {
            id: true,
            grade: true,
            student: {
              select: {
                id: true,
                studentNumber: true,
                user: { select: { email: true, profile: true } },
              },
            },
            section: {
              select: {
                id: true,
                course: { select: { code: true, title: true } },
              },
            },
          },
        },
      },
    });
  }

  countPendingOverrides(institutionId: string) {
    return this.prisma.gradeOverride.count({
      where: this.buildPendingOverridesWhere(institutionId),
    });
  }

  findPendingOverride(institutionId: string, id: string) {
    return this.prisma.gradeOverride.findFirst({
      where: { id, institutionId, deletedAt: null, approvedById: null },
      include: { enrollment: { select: { id: true, institutionId: true } } },
    });
  }

  async approveGradeOverrideAndApplyEnrollment(params: {
    overrideId: string;
    approvedById: string;
    enrollmentId: string;
    grade: Prisma.InputJsonValue;
  }) {
    await this.prisma.$transaction([
      this.prisma.gradeOverride.update({
        where: { id: params.overrideId },
        data: { approvedById: params.approvedById },
      }),
      this.prisma.studentEnrollment.update({
        where: { id: params.enrollmentId },
        data: { grade: params.grade },
      }),
    ]);
    return this.prisma.gradeOverride.findFirst({
      where: { id: params.overrideId },
      include: {
        requester: { select: { id: true, email: true } },
        approver: { select: { id: true, email: true } },
        enrollment: {
          select: {
            id: true,
            grade: true,
            student: {
              select: {
                id: true,
                studentNumber: true,
                user: { select: { email: true, profile: true } },
              },
            },
            section: {
              select: {
                id: true,
                course: { select: { code: true, title: true } },
              },
            },
          },
        },
      },
    });
  }

  softDeleteGradeOverride(institutionId: string, id: string, at: Date) {
    return this.prisma.gradeOverride.updateMany({
      where: { id, institutionId, deletedAt: null, approvedById: null },
      data: { deletedAt: at },
    });
  }
}
