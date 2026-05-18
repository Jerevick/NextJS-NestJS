import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { assertEntityAccess } from '../org-structure/org-structure.utils';
import { PrismaService } from '../prisma/prisma.service';
import { buildOrgChartTree } from './org-chart.util';
import { OrgChartRepository } from './org-chart.repository';

@Injectable()
export class OrgChartService {
  constructor(
    private readonly repo: OrgChartRepository,
    private readonly prisma: PrismaService,
  ) {}

  async orgChart(user: AuthUser, entityId: string) {
    assertEntityAccess(user, entityId);

    const entity = await this.prisma.institutionEntity.findFirst({
      where: { id: entityId, institutionId: user.institutionId, deletedAt: null },
      select: { id: true, code: true, name: true },
    });
    if (!entity) {
      throw new NotFoundException('Campus entity not found');
    }

    const units = await this.repo.orgUnitsWithHolders(user.institutionId, entityId);
    return {
      entityId,
      entity: { id: entity.id, code: entity.code, name: entity.name },
      tree: buildOrgChartTree(units as Parameters<typeof buildOrgChartTree>[0]),
    };
  }
}
