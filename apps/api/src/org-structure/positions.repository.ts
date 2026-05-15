import { Injectable } from '@nestjs/common';
import type { PositionScope, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const holderInclude = {
  user: { select: { id: true, email: true, role: true, profile: true } },
  appointedBy: { select: { id: true, email: true } },
} as const;

const positionInclude = {
  orgUnit: { select: { id: true, code: true, name: true, type: true } },
  holders: {
    where: { endDate: null },
    include: holderInclude,
    orderBy: { startDate: 'desc' as const },
  },
} as const;

@Injectable()
export class PositionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findManyForEntity(institutionId: string, entityId: string) {
    return this.prisma.position.findMany({
      where: { institutionId, entityId, deletedAt: null },
      include: positionInclude,
      orderBy: [{ level: 'asc' }, { title: 'asc' }],
    });
  }

  findVacantForEntity(institutionId: string, entityId: string) {
    return this.prisma.position.findMany({
      where: {
        institutionId,
        entityId,
        deletedAt: null,
        holders: { none: { endDate: null } },
      },
      include: positionInclude,
      orderBy: [{ level: 'asc' }, { title: 'asc' }],
    });
  }

  findById(institutionId: string, entityId: string, id: string) {
    return this.prisma.position.findFirst({
      where: { id, institutionId, entityId, deletedAt: null },
      include: positionInclude,
    });
  }

  create(data: {
    institutionId: string;
    entityId: string;
    orgUnitId: string;
    code: string;
    title: string;
    level: number;
    scope: PositionScope;
    permissionBundles?: string[];
    isUnique?: boolean;
  }) {
    return this.prisma.position.create({
      data: {
        ...data,
        permissionBundles: data.permissionBundles ?? [],
        isUnique: data.isUnique ?? true,
        isActingAllowed: true,
      },
      include: positionInclude,
    });
  }

  update(id: string, data: Prisma.PositionUpdateInput) {
    return this.prisma.position.update({
      where: { id },
      data,
      include: positionInclude,
    });
  }

  softDelete(id: string) {
    return this.prisma.position.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: positionInclude,
    });
  }

  countActiveHolders(positionId: string) {
    return this.prisma.positionHolder.count({
      where: { positionId, endDate: null },
    });
  }

  createHolder(data: {
    institutionId: string;
    entityId: string;
    positionId: string;
    userId: string;
    startDate: Date;
    endDate?: Date | null;
    isActing?: boolean;
    delegatedBy?: string | null;
    appointedById: string;
  }) {
    return this.prisma.positionHolder.create({
      data,
      include: holderInclude,
    });
  }

  endActiveHolders(positionId: string, endDate: Date) {
    return this.prisma.positionHolder.updateMany({
      where: { positionId, endDate: null },
      data: { endDate },
    });
  }
}
