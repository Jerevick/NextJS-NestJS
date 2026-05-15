import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TranscriptsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findStudentHeader(institutionId: string, studentId: string) {
    return this.prisma.student.findFirst({
      where: { id: studentId, institutionId, deletedAt: null },
      select: {
        id: true,
        studentNumber: true,
        admissionDate: true,
        expectedGraduationDate: true,
        user: { select: { id: true, email: true, profile: true } },
        program: { select: { id: true, name: true, code: true, creditHours: true } },
      },
    });
  }

  findEnrollmentsForTranscript(institutionId: string, studentId: string) {
    return this.prisma.studentEnrollment.findMany({
      where: {
        studentId,
        institutionId,
        deletedAt: null,
      },
      orderBy: [{ semester: { startDate: 'asc' } }, { section: { course: { code: 'asc' } } }],
      include: {
        semester: { select: { id: true, name: true, startDate: true, endDate: true } },
        section: {
          select: {
            id: true,
            course: { select: { code: true, title: true, creditHours: true } },
          },
        },
      },
    });
  }

  createTranscript(data: {
    id: string;
    institutionId: string;
    studentId: string;
    isOfficial: boolean;
    content: Prisma.InputJsonValue;
    verificationHash: string;
    verificationUrl: string;
    generatedAt: Date;
  }) {
    return this.prisma.transcript.create({
      data: {
        id: data.id,
        institutionId: data.institutionId,
        studentId: data.studentId,
        isOfficial: data.isOfficial,
        content: data.content,
        verificationHash: data.verificationHash,
        verificationUrl: data.verificationUrl,
        generatedAt: data.generatedAt,
      },
      include: {
        student: {
          select: {
            id: true,
            studentNumber: true,
            user: { select: { email: true, profile: true } },
            program: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
  }

  findById(institutionId: string, id: string) {
    return this.prisma.transcript.findFirst({
      where: { id, institutionId, deletedAt: null },
      include: {
        student: {
          select: {
            id: true,
            studentNumber: true,
            user: { select: { email: true, profile: true } },
            program: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
  }

  findByVerificationHash(verificationHash: string) {
    return this.prisma.transcript.findFirst({
      where: { verificationHash, deletedAt: null },
      select: {
        id: true,
        generatedAt: true,
        isOfficial: true,
        student: { select: { studentNumber: true } },
      },
    });
  }

  listForStudent(institutionId: string, studentId: string, take: number, cursor?: string) {
    return this.prisma.transcript.findMany({
      where: { institutionId, studentId, deletedAt: null },
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        generatedAt: true,
        isOfficial: true,
        verificationUrl: true,
        createdAt: true,
      },
    });
  }

  countForStudent(institutionId: string, studentId: string) {
    return this.prisma.transcript.count({
      where: { institutionId, studentId, deletedAt: null },
    });
  }
}
