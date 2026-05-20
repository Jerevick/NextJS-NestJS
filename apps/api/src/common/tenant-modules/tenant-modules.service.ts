import { ForbiddenException, Injectable } from '@nestjs/common';
import { TenantModule } from '@prisma/client';
import type { AuthUser } from '../../auth/auth.types';
import { parseEntitySettings } from '../../institution-entities/entity-settings.types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildSisLmsBridgeWhenBothModules,
  mergeSisLmsBridgeIntoSettings,
  readSisLmsBridgeSettings,
} from './sis-lms-bridge.util';

export {
  CORE_TENANT_MODULES,
  MODULES_BUNDLED_WITH_LMS,
  MODULES_BUNDLED_WITH_SIS,
  OUT_OF_BOX_TENANT_MODULES,
  REGISTRATION_TENANT_MODULES,
  buildInstitutionModulePairs,
  bundledModulesForCore,
  isCoreTenantModule,
  isOutOfBoxTenantModule,
  resolveModulesFromCoreSelection,
} from './tenant-module-packages';

@Injectable()
export class TenantModulesService {
  constructor(private readonly prisma: PrismaService) {}

  async isEnabled(institutionId: string, module: TenantModule): Promise<boolean> {
    const row = await this.prisma.institutionModule.findFirst({
      where: { institutionId, module, deletedAt: null },
      select: { enabled: true },
    });
    return Boolean(row?.enabled);
  }

  async readSisLmsBridge(institutionId: string) {
    const inst = await this.prisma.institution.findFirst({
      where: { id: institutionId, deletedAt: null },
      select: { settings: true },
    });
    return readSisLmsBridgeSettings(inst?.settings);
  }

  /** Persist SIS↔LMS bridge when both modules are enabled so they run concurrently. */
  async syncSisLmsBridge(institutionId: string): Promise<void> {
    const [sis, lms] = await Promise.all([
      this.isEnabled(institutionId, TenantModule.SIS),
      this.isEnabled(institutionId, TenantModule.LMS),
    ]);
    const inst = await this.prisma.institution.findFirst({
      where: { id: institutionId, deletedAt: null },
      select: { settings: true },
    });
    const bridge = buildSisLmsBridgeWhenBothModules(sis, lms);
    const settings = mergeSisLmsBridgeIntoSettings(inst?.settings, bridge);
    await this.prisma.institution.update({
      where: { id: institutionId },
      data: { settings: settings as object },
    });
  }

  /** LMS student routes: LMS on, and SIS+LMS bridge active when SIS is also enabled. */
  async assertConcurrentLmsAccess(actor: AuthUser): Promise<void> {
    const entityId = actor.entityScope === 'ENTITY' ? actor.entityId : undefined;
    await this.assertEnabled(actor.institutionId, TenantModule.LMS, entityId);

    const sisOn = await this.isEnabled(actor.institutionId, TenantModule.SIS);
    if (!sisOn) {
      return;
    }

    const bridge = await this.readSisLmsBridge(actor.institutionId);
    if (!bridge.enabled) {
      throw new ForbiddenException(
        'SIS and LMS are both enabled but not linked. Enable the SIS–LMS connection in institution settings.',
      );
    }
  }

  async assertEnabled(
    institutionId: string,
    module: TenantModule,
    entityId?: string,
  ): Promise<void> {
    const row = await this.prisma.institutionModule.findFirst({
      where: { institutionId, module, deletedAt: null },
    });
    if (!row?.enabled) {
      throw new ForbiddenException(`Module ${module} is not enabled for this institution`);
    }

    if (!entityId) {
      return;
    }

    const entity = await this.prisma.institutionEntity.findFirst({
      where: { id: entityId, institutionId, deletedAt: null },
      select: { settings: true },
    });
    const entityModules = parseEntitySettings(entity?.settings).modules;
    if (entityModules?.length && !entityModules.includes(module)) {
      throw new ForbiddenException(`Module ${module} is not enabled for this campus`);
    }
  }
}
