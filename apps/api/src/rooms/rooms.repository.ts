import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoomsRepository {
  constructor(private readonly prisma: PrismaService) {}

  buildListWhere(args: {
    institutionId: string;
    building?: string;
    type?: string;
    search?: string;
  }): Prisma.RoomWhereInput {
    const where: Prisma.RoomWhereInput = {
      institutionId: args.institutionId,
      deletedAt: null,
    };
    if (args.building) {
      where.building = { equals: args.building, mode: 'insensitive' };
    }
    if (args.type) {
      where.type = { equals: args.type, mode: 'insensitive' };
    }
    if (args.search?.trim()) {
      const q = args.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { building: { contains: q, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  findPage(where: Prisma.RoomWhereInput, take: number, cursor?: string) {
    return this.prisma.room.findMany({
      where,
      take: take + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ building: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    });
  }

  countWhere(where: Prisma.RoomWhereInput) {
    return this.prisma.room.count({ where });
  }

  findById(institutionId: string, id: string) {
    return this.prisma.room.findFirst({
      where: { id, institutionId, deletedAt: null },
    });
  }

  findByBuildingName(institutionId: string, building: string, name: string) {
    return this.prisma.room.findFirst({
      where: {
        institutionId,
        deletedAt: null,
        building: { equals: building, mode: 'insensitive' },
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
  }

  create(data: {
    institutionId: string;
    building: string;
    name: string;
    capacity: number;
    type: string;
    facilities: Prisma.InputJsonValue;
  }) {
    return this.prisma.room.create({ data });
  }

  update(id: string, data: Prisma.RoomUpdateInput) {
    return this.prisma.room.update({ where: { id }, data });
  }

  softDelete(institutionId: string, id: string, at: Date) {
    return this.prisma.room.updateMany({
      where: { id, institutionId, deletedAt: null },
      data: { deletedAt: at },
    });
  }
}
