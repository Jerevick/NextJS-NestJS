import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
const profileInclude = {
  user: { select: { id: true, email: true, profile: true } },
  entity: { select: { id: true, code: true, name: true } },
  orgUnit: { select: { id: true, name: true, code: true } },
  position: { select: { id: true, title: true, code: true, level: true } },
} satisfies Prisma.StaffProfileInclude;

@Injectable()
export class StaffRepository {
  constructor(private readonly prisma: PrismaService) {}

  listProfiles(institutionId: string, entityId?: string) {
    return this.prisma.staffProfile.findMany({
      where: {
        institutionId,
        deletedAt: null,
        ...(entityId ? { entityId } : {}),
      },
      include: profileInclude,
      orderBy: { staffNumber: 'asc' },
    });
  }

  findProfile(institutionId: string, id: string, entityId?: string) {
    return this.prisma.staffProfile.findFirst({
      where: {
        id,
        institutionId,
        deletedAt: null,
        ...(entityId ? { entityId } : {}),
      },
      include: profileInclude,
    });
  }

  findProfileByUserId(institutionId: string, userId: string) {
    return this.prisma.staffProfile.findFirst({
      where: { institutionId, userId, deletedAt: null },
      include: profileInclude,
    });
  }

  createProfile(data: Prisma.StaffProfileUncheckedCreateInput) {
    return this.prisma.staffProfile.create({ data, include: profileInclude });
  }

  updateProfile(institutionId: string, id: string, data: Prisma.StaffProfileUncheckedUpdateInput) {
    return this.prisma.staffProfile.updateMany({
      where: { id, institutionId, deletedAt: null },
      data,
    });
  }

  softDeleteProfile(institutionId: string, id: string) {
    return this.prisma.staffProfile.updateMany({
      where: { id, institutionId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  listUsersWithoutStaffProfile(institutionId: string, query?: string) {
    const q = query?.trim();
    return this.prisma.user.findMany({
      where: {
        institutionId,
        deletedAt: null,
        staffProfile: null,
        ...(q
          ? {
              OR: [{ email: { contains: q, mode: 'insensitive' } }],
            }
          : {}),
      },
      select: { id: true, email: true, profile: true },
      orderBy: { email: 'asc' },
      take: 50,
    });
  }

  listWorkload(institutionId: string, entityId: string, semesterId: string) {
    return this.prisma.workloadRecord.findMany({
      where: { institutionId, entityId, semesterId },
      include: {
        staff: {
          select: {
            id: true,
            staffNumber: true,
            user: { select: { email: true, profile: true } },
          },
        },
      },
    });
  }

  upsertWorkload(data: Prisma.WorkloadRecordUncheckedCreateInput) {
    return this.prisma.workloadRecord.upsert({
      where: {
        staffId_semesterId: { staffId: data.staffId, semesterId: data.semesterId },
      },
      create: data,
      update: {
        assignedSections: data.assignedSections,
        totalCreditHours: data.totalCreditHours,
        maxCreditHours: data.maxCreditHours,
        researchHours: data.researchHours,
        adminHours: data.adminHours,
      },
      include: {
        staff: {
          select: {
            id: true,
            staffNumber: true,
            user: { select: { email: true, profile: true } },
          },
        },
      },
    });
  }
}
