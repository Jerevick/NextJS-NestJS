import { Injectable, Logger } from '@nestjs/common';
import type { InstitutionEntityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { orgTemplateForEntityType, type OrgTemplateUnit } from './entity-type-org-templates';
import { PermissionBundlesService } from './permission-bundles.service';

export type ApplyOrgTemplateResult = {
  entityId: string;
  orgUnitsCreated: number;
  positionsCreated: number;
  skipped: boolean;
};

@Injectable()
export class OrgTemplatesService {
  private readonly log = new Logger(OrgTemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionBundles: PermissionBundlesService,
  ) {}

  async ensureDefaultBundles(institutionId: string): Promise<void> {
    await this.permissionBundles.seedDefaultsForInstitution(institutionId);
  }

  async applyToEntity(
    institutionId: string,
    entityId: string,
    entityType: InstitutionEntityType,
    options?: { force?: boolean },
  ): Promise<ApplyOrgTemplateResult> {
    await this.ensureDefaultBundles(institutionId);

    const existing = await this.prisma.orgUnit.count({
      where: { institutionId, entityId, deletedAt: null },
    });
    if (existing > 0 && !options?.force) {
      return { entityId, orgUnitsCreated: 0, positionsCreated: 0, skipped: true };
    }

    const template = orgTemplateForEntityType(entityType);
    const codeToId = new Map<string, string>();
    let orgUnitsCreated = 0;
    let positionsCreated = 0;

    const createUnits = async (units: OrgTemplateUnit[], parentId: string | null): Promise<void> => {
      for (const u of units) {
        const row = await this.prisma.orgUnit.create({
          data: {
            institutionId,
            entityId,
            code: u.code,
            name: u.name,
            type: u.type,
            parentId,
            sortOrder: u.sortOrder,
            isActive: true,
          },
        });
        codeToId.set(u.code, row.id);
        orgUnitsCreated += 1;
        if (u.children?.length) {
          await createUnits(u.children, row.id);
        }
      }
    };

    await createUnits(template.units, null);

    for (const p of template.positions) {
      const orgUnitId = codeToId.get(p.orgUnitCode);
      if (!orgUnitId) {
        this.log.warn(`org template position ${p.code}: missing unit ${p.orgUnitCode}`);
        continue;
      }
      await this.prisma.position.create({
        data: {
          institutionId,
          entityId,
          orgUnitId,
          code: p.code,
          title: p.title,
          level: p.level,
          scope: p.scope,
          permissionBundles: p.permissionBundles,
          isUnique: p.isUnique ?? true,
          isActingAllowed: true,
        },
      });
      positionsCreated += 1;
    }

    this.log.log(
      `org template applied institution=${institutionId} entity=${entityId} units=${orgUnitsCreated} positions=${positionsCreated}`,
    );
    return { entityId, orgUnitsCreated, positionsCreated, skipped: false };
  }
}
