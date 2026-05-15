import { Injectable } from '@nestjs/common';
import type { OrgUnitType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrgUnitsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyForEntity(institutionId: string, entityId: string) {
    return this.prisma.orgUnit.findMany({
      where: { institutionId, entityId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  findById(institutionId: string, entityId: string, id: string) {
    return this.prisma.orgUnit.findFirst({
      where: { id, institutionId, entityId, deletedAt: null },
    });
  }

  findByCode(institutionId: string, entityId: string, code: string) {
    return this.prisma.orgUnit.findFirst({
      where: { institutionId, entityId, code, deletedAt: null },
    });
  }

  create(data: {
    institutionId: string;
    entityId: string;
    code: string;
    name: string;
    type: OrgUnitType;
    parentId?: string | null;
    sortOrder?: number;
  }) {
    return this.prisma.orgUnit.create({ data: { ...data, isActive: true } });
  }

  update(id: string, data: Prisma.OrgUnitUpdateInput) {
    return this.prisma.orgUnit.update({ where: { id }, data });
  }

  softDelete(id: string) {
    return this.prisma.orgUnit.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  countActiveChildren(parentId: string) {
    return this.prisma.orgUnit.count({
      where: { parentId, deletedAt: null, isActive: true },
    });
  }

  countPositions(orgUnitId: string) {
    return this.prisma.position.count({
      where: { orgUnitId, deletedAt: null },
    });
  }
}
