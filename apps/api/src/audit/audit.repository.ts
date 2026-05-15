import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  buildListWhere(args: {
    institutionId: string;
    entity?: string;
    action?: string;
    entityId?: string;
    from?: Date;
    to?: Date;
  }): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {
      institutionId: args.institutionId,
    };
    if (args.entity?.trim()) {
      where.entity = { equals: args.entity.trim(), mode: 'insensitive' };
    }
    if (args.action?.trim()) {
      where.action = { equals: args.action.trim(), mode: 'insensitive' };
    }
    if (args.entityId?.trim()) {
      where.entityId = args.entityId.trim();
    }
    if (args.from || args.to) {
      where.createdAt = {};
      if (args.from) {
        where.createdAt.gte = args.from;
      }
      if (args.to) {
        where.createdAt.lte = args.to;
      }
    }
    return where;
  }

  findPage(where: Prisma.AuditLogWhereInput, take: number, cursor?: string) {
    return this.prisma.auditLog.findMany({
      where,
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        actor: {
          select: { id: true, email: true, profile: true },
        },
      },
    });
  }

  countWhere(where: Prisma.AuditLogWhereInput) {
    return this.prisma.auditLog.count({ where });
  }

  countInstitutionById(id: string) {
    return this.prisma.institution.count({ where: { id, deletedAt: null } });
  }

  create(data: Prisma.AuditLogCreateInput) {
    return this.prisma.auditLog.create({ data });
  }
}
