import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const staffProfileOnUnitInclude = {
  where: { deletedAt: null },
  select: {
    id: true,
    staffNumber: true,
    user: { select: { email: true, profile: true } },
    position: { select: { id: true, title: true, code: true } },
  },
} as const;

@Injectable()
export class OrgChartRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Org units for an entity with active position holders and assigned staff profiles. */
  orgUnitsWithHolders(institutionId: string, entityId: string) {
    return this.prisma.orgUnit.findMany({
      where: { institutionId, entityId, deletedAt: null },
      include: {
        positions: {
          where: { deletedAt: null },
          orderBy: { title: 'asc' },
          include: {
            holders: {
              where: { OR: [{ endDate: null }, { endDate: { gt: new Date() } }] },
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    profile: true,
                    staffProfile: {
                      select: {
                        id: true,
                        staffNumber: true,
                        user: { select: { profile: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        staffProfiles: staffProfileOnUnitInclude,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }
}
