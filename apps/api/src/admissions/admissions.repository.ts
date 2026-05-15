import { Injectable } from '@nestjs/common';
import type {
  AdmissionCycleStatus,
  ApplicationStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdmissionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAcademicYear(institutionId: string, id: string) {
    return this.prisma.academicYear.findFirst({
      where: { id, institutionId, deletedAt: null },
      select: { id: true },
    });
  }

  findProgram(institutionId: string, id: string) {
    return this.prisma.program.findFirst({
      where: { id, institutionId, deletedAt: null },
      select: { id: true },
    });
  }

  findUser(institutionId: string, id: string) {
    return this.prisma.user.findFirst({
      where: { id, institutionId, deletedAt: null },
      select: { id: true },
    });
  }

  findStudent(institutionId: string, id: string) {
    return this.prisma.student.findFirst({
      where: { id, institutionId, deletedAt: null },
      select: { id: true },
    });
  }

  createCycle(data: {
    institutionId: string;
    name: string;
    academicYearId: string;
    applicationOpenDate: Date;
    applicationCloseDate: Date;
    status: AdmissionCycleStatus;
    quota: Prisma.InputJsonValue;
  }) {
    return this.prisma.admissionCycle.create({
      data: {
        institutionId: data.institutionId,
        name: data.name,
        academicYearId: data.academicYearId,
        applicationOpenDate: data.applicationOpenDate,
        applicationCloseDate: data.applicationCloseDate,
        status: data.status,
        quota: data.quota,
      },
      include: {
        academicYear: { select: { id: true, name: true, startDate: true, endDate: true } },
      },
    });
  }

  findCycle(institutionId: string, id: string) {
    return this.prisma.admissionCycle.findFirst({
      where: { id, institutionId, deletedAt: null },
      include: {
        academicYear: { select: { id: true, name: true, startDate: true, endDate: true } },
      },
    });
  }

  buildCycleWhere(args: { institutionId: string; status?: AdmissionCycleStatus }): Prisma.AdmissionCycleWhereInput {
    const where: Prisma.AdmissionCycleWhereInput = {
      institutionId: args.institutionId,
      deletedAt: null,
    };
    if (args.status) {
      where.status = args.status;
    }
    return where;
  }

  findCyclesPage(where: Prisma.AdmissionCycleWhereInput, take: number, cursor?: string) {
    return this.prisma.admissionCycle.findMany({
      where,
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ applicationOpenDate: 'desc' }, { id: 'desc' }],
      include: {
        academicYear: { select: { id: true, name: true, startDate: true, endDate: true } },
      },
    });
  }

  countCycles(where: Prisma.AdmissionCycleWhereInput) {
    return this.prisma.admissionCycle.count({ where });
  }

  updateCycle(id: string, data: Prisma.AdmissionCycleUpdateInput) {
    return this.prisma.admissionCycle.update({
      where: { id },
      data,
      include: {
        academicYear: { select: { id: true, name: true, startDate: true, endDate: true } },
      },
    });
  }

  softDeleteCycle(institutionId: string, id: string, at: Date) {
    return this.prisma.admissionCycle.updateMany({
      where: { id, institutionId, deletedAt: null },
      data: { deletedAt: at },
    });
  }

  createForm(data: { institutionId: string; cycleId: string; schema: Prisma.InputJsonValue }) {
    return this.prisma.applicationForm.create({
      data: {
        institutionId: data.institutionId,
        cycleId: data.cycleId,
        schema: data.schema,
      },
    });
  }

  listForms(institutionId: string, cycleId: string) {
    return this.prisma.applicationForm.findMany({
      where: { institutionId, cycleId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  findForm(institutionId: string, id: string) {
    return this.prisma.applicationForm.findFirst({
      where: { id, institutionId, deletedAt: null },
    });
  }

  updateForm(id: string, schema: Prisma.InputJsonValue) {
    return this.prisma.applicationForm.update({
      where: { id },
      data: { schema },
    });
  }

  softDeleteForm(institutionId: string, id: string, at: Date) {
    return this.prisma.applicationForm.updateMany({
      where: { id, institutionId, deletedAt: null },
      data: { deletedAt: at },
    });
  }

  findDuplicateApplication(institutionId: string, cycleId: string, applicantId: string, programId: string) {
    return this.prisma.application.findFirst({
      where: {
        institutionId,
        cycleId,
        applicantId,
        programId,
        deletedAt: null,
      },
      select: { id: true },
    });
  }

  createApplication(data: {
    institutionId: string;
    cycleId: string;
    programId: string;
    applicantId: string;
    personalStatement: string | null;
    documents: Prisma.InputJsonValue;
  }) {
    return this.prisma.application.create({
      data: {
        institutionId: data.institutionId,
        cycleId: data.cycleId,
        programId: data.programId,
        applicantId: data.applicantId,
        personalStatement: data.personalStatement,
        documents: data.documents,
      },
      include: {
        cycle: { select: { id: true, name: true, status: true } },
        program: { select: { id: true, name: true, code: true } },
        applicant: { select: { id: true, email: true, profile: true } },
        reviewer: { select: { id: true, email: true } },
        student: { select: { id: true, studentNumber: true } },
      },
    });
  }

  findApplication(institutionId: string, id: string) {
    return this.prisma.application.findFirst({
      where: { id, institutionId, deletedAt: null },
      include: {
        cycle: { select: { id: true, name: true, status: true } },
        program: { select: { id: true, name: true, code: true } },
        applicant: { select: { id: true, email: true, profile: true } },
        reviewer: { select: { id: true, email: true } },
        student: { select: { id: true, studentNumber: true } },
      },
    });
  }

  buildApplicationWhere(args: {
    institutionId: string;
    cycleId?: string;
    status?: ApplicationStatus;
    applicantId?: string;
  }): Prisma.ApplicationWhereInput {
    const where: Prisma.ApplicationWhereInput = {
      institutionId: args.institutionId,
      deletedAt: null,
    };
    if (args.cycleId) {
      where.cycleId = args.cycleId;
    }
    if (args.status) {
      where.status = args.status;
    }
    if (args.applicantId) {
      where.applicantId = args.applicantId;
    }
    return where;
  }

  findApplicationsPage(where: Prisma.ApplicationWhereInput, take: number, cursor?: string) {
    return this.prisma.application.findMany({
      where,
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        cycle: { select: { id: true, name: true, status: true } },
        program: { select: { id: true, name: true, code: true } },
        applicant: { select: { id: true, email: true, profile: true } },
        reviewer: { select: { id: true, email: true } },
        student: { select: { id: true, studentNumber: true } },
      },
    });
  }

  countApplications(where: Prisma.ApplicationWhereInput) {
    return this.prisma.application.count({ where });
  }

  updateApplication(id: string, data: Prisma.ApplicationUpdateInput) {
    return this.prisma.application.update({
      where: { id },
      data,
      include: {
        cycle: { select: { id: true, name: true, status: true } },
        program: { select: { id: true, name: true, code: true } },
        applicant: { select: { id: true, email: true, profile: true } },
        reviewer: { select: { id: true, email: true } },
        student: { select: { id: true, studentNumber: true } },
      },
    });
  }

  softDeleteApplication(institutionId: string, id: string, at: Date) {
    return this.prisma.application.updateMany({
      where: { id, institutionId, deletedAt: null },
      data: { deletedAt: at },
    });
  }
}
