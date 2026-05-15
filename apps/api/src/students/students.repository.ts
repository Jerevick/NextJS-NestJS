import { Injectable } from '@nestjs/common';
import type { Prisma, StudentEnrollmentStatusEnum } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type StudentWithUserProgram = Prisma.StudentGetPayload<{
  include: {
    user: { select: { id: true; email: true; profile: true; isActive: true } };
    program: { select: { id: true; name: true; code: true } };
    entity: { select: { id: true; code: true; name: true; type: true; status: true } };
  };
}>;

export type StudentListWhere = {
  institutionId: string;
  search?: string;
  programId?: string;
  enrollmentStatus?: StudentEnrollmentStatusEnum;
};

@Injectable()
export class StudentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProgramInInstitution(institutionId: string, programId: string) {
    return this.prisma.program.findFirst({
      where: { id: programId, institutionId, deletedAt: null },
      select: { id: true, code: true, name: true, entityId: true },
    });
  }

  findEntityForStudent(institutionId: string, entityId: string) {
    return this.prisma.institutionEntity.findFirst({
      where: { id: entityId, institutionId, deletedAt: null },
      select: { id: true },
    });
  }

  findDefaultMainEntityId(institutionId: string) {
    return this.prisma.institutionEntity.findFirst({
      where: {
        institutionId,
        code: 'MAIN',
        deletedAt: null,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
  }

  findUserByEmailInInstitution(institutionId: string, email: string) {
    return this.prisma.user.findFirst({
      where: { institutionId, email: email.toLowerCase(), deletedAt: null },
      select: { id: true },
    });
  }

  getInstitutionSettings(institutionId: string) {
    return this.prisma.institution.findFirst({
      where: { id: institutionId, deletedAt: null },
      select: { settings: true },
    });
  }

  countStudentsForNumbering(institutionId: string, programId: string, yearStart: Date) {
    return this.prisma.student.count({
      where: {
        institutionId,
        programId,
        deletedAt: null,
        createdAt: { gte: yearStart },
      },
    });
  }

  buildWhere(args: StudentListWhere): Prisma.StudentWhereInput {
    const { institutionId, search, programId, enrollmentStatus } = args;
    const where: Prisma.StudentWhereInput = {
      institutionId,
      deletedAt: null,
    };
    if (programId) {
      where.programId = programId;
    }
    if (enrollmentStatus) {
      where.enrollmentStatus = enrollmentStatus;
    }
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { studentNumber: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }
    return where;
  }

  async findPage(where: Prisma.StudentWhereInput, take: number, cursor?: string) {
    return this.prisma.student.findMany({
      where,
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      include: {
        user: { select: { id: true, email: true, profile: true, isActive: true } },
        program: { select: { id: true, name: true, code: true } },
        entity: { select: { id: true, code: true, name: true, type: true, status: true } },
      },
    });
  }

  countWhere(where: Prisma.StudentWhereInput) {
    return this.prisma.student.count({ where });
  }

  findStatusChangeLogsForStudent(institutionId: string, studentId: string, take: number) {
    return this.prisma.statusChangeLog.findMany({
      where: { institutionId, studentId },
      orderBy: { recordedAt: 'desc' },
      take,
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        reason: true,
        billingImplication: true,
        recordedAt: true,
        actor: { select: { role: true } },
      },
    });
  }

  findById(institutionId: string, id: string) {
    return this.prisma.student.findFirst({
      where: { id, institutionId, deletedAt: null },
      include: {
        user: { select: { id: true, email: true, profile: true, isActive: true } },
        program: { select: { id: true, name: true, code: true, creditHours: true } },
        entity: { select: { id: true, code: true, name: true, type: true, status: true } },
        enrollments: {
          where: { deletedAt: null },
          include: {
            section: {
              include: {
                course: { select: { code: true, title: true, creditHours: true } },
              },
            },
            semester: { select: { id: true, name: true, startDate: true } },
          },
        },
      },
    });
  }

  createUserAndStudent(args: {
    institutionId: string;
    entityId: string;
    email: string;
    passwordHash: string;
    profile: Prisma.InputJsonValue;
    programId: string;
    studentNumber: string;
    currentLevel: number;
    admissionDate?: Date;
    expectedGraduationDate?: Date;
    guardians: Prisma.InputJsonValue;
    emergencyContacts: Prisma.InputJsonValue;
    specialNeeds: Prisma.InputJsonValue;
    photo?: string | null;
  }) {
    return this.prisma.$transaction(async (tx): Promise<StudentWithUserProgram> => {
      const user = await tx.user.create({
        data: {
          institutionId: args.institutionId,
          email: args.email.toLowerCase(),
          passwordHash: args.passwordHash,
          role: UserRole.STUDENT,
          profile: args.profile,
          isActive: true,
        },
      });
      const student = await tx.student.create({
        data: {
          userId: user.id,
          institutionId: args.institutionId,
          entityId: args.entityId,
          studentNumber: args.studentNumber,
          programId: args.programId,
          currentLevel: args.currentLevel,
          admissionDate: args.admissionDate,
          expectedGraduationDate: args.expectedGraduationDate,
          guardians: args.guardians,
          emergencyContacts: args.emergencyContacts,
          specialNeeds: args.specialNeeds,
          photo: args.photo,
        },
        include: {
          user: { select: { id: true, email: true, profile: true, isActive: true } },
          program: { select: { id: true, name: true, code: true } },
          entity: { select: { id: true, code: true, name: true, type: true, status: true } },
        },
      });
      return student;
    });
  }

  findStudentByUserId(institutionId: string, userId: string) {
    return this.prisma.student.findFirst({
      where: { institutionId, userId, deletedAt: null },
      select: { id: true, studentNumber: true },
    });
  }

  createStudentForExistingUser(args: {
    institutionId: string;
    entityId: string;
    userId: string;
    programId: string;
    studentNumber: string;
    currentLevel: number;
    admissionDate?: Date;
  }) {
    return this.prisma.student.create({
      data: {
        userId: args.userId,
        institutionId: args.institutionId,
        entityId: args.entityId,
        studentNumber: args.studentNumber,
        programId: args.programId,
        currentLevel: args.currentLevel,
        admissionDate: args.admissionDate ?? new Date(),
        enrollmentStatus: 'ACTIVE',
      },
      include: {
        user: { select: { id: true, email: true, profile: true, isActive: true } },
        program: { select: { id: true, name: true, code: true } },
        entity: { select: { id: true, code: true, name: true, type: true, status: true } },
      },
    });
  }

  async updateStudent(institutionId: string, id: string, data: Prisma.StudentUpdateInput) {
    const existing = await this.prisma.student.findFirst({
      where: { id, institutionId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      return null;
    }
    return this.prisma.student.update({
      where: { id: existing.id },
      data,
      include: {
        user: { select: { id: true, email: true, profile: true, isActive: true } },
        program: { select: { id: true, name: true, code: true } },
        entity: { select: { id: true, code: true, name: true, type: true, status: true } },
      },
    });
  }

  softDeleteStudent(institutionId: string, id: string, at: Date) {
    return this.prisma.$transaction(async (tx) => {
      const student = await tx.student.findFirst({
        where: { id, institutionId, deletedAt: null },
        select: { userId: true },
      });
      if (!student) {
        return { count: 0 };
      }
      await tx.student.updateMany({
        where: { id, institutionId, deletedAt: null },
        data: { deletedAt: at },
      });
      if (student.userId) {
        await tx.user.updateMany({
          where: { id: student.userId, institutionId, deletedAt: null },
          data: { deletedAt: at, isActive: false },
        });
      }
      return { count: 1 };
    });
  }
}
