import { Injectable } from '@nestjs/common';
import type { InstitutionEntityType } from '@prisma/client';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InstitutionEntitiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyForInstitution(institutionId: string): Promise<
    {
      id: string;
      code: string;
      name: string;
      type: string;
      status: string;
      settings: unknown;
      createdAt: Date;
      updatedAt: Date;
    }[]
  > {
    return this.prisma.institutionEntity.findMany({
      where: { institutionId, deletedAt: null },
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        status: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  findOneInInstitution(institutionId: string, entityId: string) {
    return this.prisma.institutionEntity.findFirst({
      where: { id: entityId, institutionId, deletedAt: null },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        status: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  countBillableStudents(institutionId: string, entityId: string): Promise<number> {
    return this.prisma.student.count({
      where: {
        institutionId,
        entityId,
        enrollmentStatus: 'ACTIVE',
        deletedAt: null,
      },
    });
  }

  createForInstitution(
    institutionId: string,
    data: { code: string; name: string; type: InstitutionEntityType; settings?: object },
  ) {
    return this.prisma.institutionEntity.create({
      data: {
        institutionId,
        code: data.code,
        name: data.name,
        type: data.type,
        status: 'PROVISIONING',
        settings: data.settings ?? {},
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        status: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  updateEntity(
    institutionId: string,
    entityId: string,
    data: { name?: string; settings?: object },
  ) {
    return this.prisma.institutionEntity.updateMany({
      where: { id: entityId, institutionId, deletedAt: null },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.settings !== undefined ? { settings: data.settings } : {}),
      },
    });
  }

  reactivateEntity(institutionId: string, entityId: string) {
    return this.prisma.institutionEntity.updateMany({
      where: { id: entityId, institutionId, deletedAt: null, status: 'SUSPENDED' },
      data: { status: 'ACTIVE' },
    });
  }

  suspendEntity(institutionId: string, entityId: string) {
    return this.prisma.institutionEntity.updateMany({
      where: { id: entityId, institutionId, deletedAt: null, status: { not: 'SUSPENDED' } },
      data: { status: 'SUSPENDED' },
    });
  }

  getLatestBillableCount(institutionId: string, entityId: string): Promise<number | null> {
    return this.prisma.dailyBillableSnapshot
      .findFirst({
        where: { institutionId, entityId },
        orderBy: { snapshotDate: 'desc' },
        select: { billableCount: true },
      })
      .then((r) => (r ? r.billableCount : null));
  }

  countMainCampusEntities(institutionId: string): Promise<number> {
    return this.prisma.institutionEntity.count({
      where: { institutionId, type: 'MAIN_CAMPUS', deletedAt: null },
    });
  }

  countTotalStudentsForEntity(institutionId: string, entityId: string): Promise<number> {
    return this.prisma.student.count({
      where: { institutionId, entityId, deletedAt: null },
    });
  }

  countInactiveStudentsForEntity(institutionId: string, entityId: string): Promise<number> {
    return this.prisma.student.count({
      where: {
        institutionId,
        entityId,
        deletedAt: null,
        NOT: { enrollmentStatus: 'ACTIVE' },
      },
    });
  }

  /** Distinct staff/admin users with explicit campus access or teaching a section on this entity. */
  async countDistinctStaffForEntity(institutionId: string, entityId: string): Promise<number> {
    const fromAccess = await this.prisma.userEntityAccess.findMany({
      where: {
        entityId,
        user: {
          institutionId,
          deletedAt: null,
          role: { in: [UserRole.ADMIN, UserRole.STAFF, UserRole.FACULTY] },
        },
      },
      select: { userId: true },
    });
    const fromTeaching = await this.prisma.section.findMany({
      where: { institutionId, entityId, deletedAt: null, instructorId: { not: null } },
      select: { instructorId: true },
    });
    const ids = new Set<string>();
    for (const a of fromAccess) {
      ids.add(a.userId);
    }
    for (const s of fromTeaching) {
      if (s.instructorId) {
        ids.add(s.instructorId);
      }
    }
    return ids.size;
  }

  /** ENROLLED section seats in the current academic year for sections on this campus. */
  countEnrollmentsCurrentAcademicYearForEntity(institutionId: string, entityId: string): Promise<number> {
    return this.prisma.studentEnrollment.count({
      where: {
        institutionId,
        deletedAt: null,
        status: 'ENROLLED',
        section: { entityId, deletedAt: null },
        semester: {
          deletedAt: null,
          academicYear: { institutionId, isCurrent: true, deletedAt: null },
        },
      },
    });
  }

  getLatestBillableSnapshotDateForEntity(institutionId: string, entityId: string): Promise<Date | null> {
    return this.prisma.dailyBillableSnapshot
      .findFirst({
        where: { institutionId, entityId },
        orderBy: { snapshotDate: 'desc' },
        select: { snapshotDate: true },
      })
      .then((r) => r?.snapshotDate ?? null);
  }
}
