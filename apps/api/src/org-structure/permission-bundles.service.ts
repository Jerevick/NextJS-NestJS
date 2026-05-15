import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_PERMISSION_BUNDLES } from './default-permission-bundles';
import { assertInstitutionAccess, assertOrgRead } from './org-structure.utils';

@Injectable()
export class PermissionBundlesService {
  constructor(private readonly prisma: PrismaService) {}

  async seedDefaultsForInstitution(institutionId: string): Promise<number> {
    let created = 0;
    for (const b of DEFAULT_PERMISSION_BUNDLES) {
      const existing = await this.prisma.permissionBundle.findFirst({
        where: { institutionId, code: b.code, deletedAt: null },
      });
      if (existing) {
        continue;
      }
      await this.prisma.permissionBundle.create({
        data: {
          institutionId,
          code: b.code,
          name: b.name,
          description: b.description,
          permissions: b.permissions,
        },
      });
      created += 1;
    }
    return created;
  }

  async listForInstitution(actor: AuthUser, institutionId: string) {
    assertOrgRead(actor);
    assertInstitutionAccess(actor, institutionId);
    const rows = await this.prisma.permissionBundle.findMany({
      where: { institutionId, deletedAt: null },
      orderBy: { code: 'asc' },
    });
    return { data: rows };
  }
}
