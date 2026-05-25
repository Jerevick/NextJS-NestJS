import { TenantModule } from '@prisma/client';

/** Core campus stack — SIS and LMS can run concurrently via the SIS↔LMS bridge. */
export const CORE_TENANT_MODULES: TenantModule[] = [TenantModule.SIS, TenantModule.LMS];

/** Out-of-the-box modules included when SIS is selected (not separately selectable). */
export const MODULES_BUNDLED_WITH_SIS: TenantModule[] = [
  TenantModule.FINANCE,
  TenantModule.HR,
  TenantModule.ELECTIONS,
  TenantModule.ALUMNI,
  TenantModule.SPORTS,
  TenantModule.MEETINGS,
];

/** LMS is selectable as a standalone learning package; native admin modules ship with SIS. */
export const MODULES_BUNDLED_WITH_LMS: TenantModule[] = [];

export const OUT_OF_BOX_TENANT_MODULES: TenantModule[] = [
  ...MODULES_BUNDLED_WITH_SIS,
  ...MODULES_BUNDLED_WITH_LMS,
];

/** Only core packages are chosen on registration; bundled modules are derived. */
export const REGISTRATION_TENANT_MODULES: TenantModule[] = [...CORE_TENANT_MODULES];

const ALL_TENANT_MODULES: TenantModule[] = [...CORE_TENANT_MODULES, ...OUT_OF_BOX_TENANT_MODULES];

export function isCoreTenantModule(module: TenantModule): boolean {
  return CORE_TENANT_MODULES.includes(module);
}

export function isOutOfBoxTenantModule(module: TenantModule): boolean {
  return OUT_OF_BOX_TENANT_MODULES.includes(module);
}

export function bundledModulesForCore(core: TenantModule): TenantModule[] {
  if (core === TenantModule.SIS) {
    return [...MODULES_BUNDLED_WITH_SIS];
  }
  if (core === TenantModule.LMS) {
    return [...MODULES_BUNDLED_WITH_LMS];
  }
  return [];
}

/** Expands SIS/LMS choices into the full module set enabled for the tenant. */
export function resolveModulesFromCoreSelection(coreSelection: TenantModule[]): TenantModule[] {
  const enabled = new Set<TenantModule>();
  for (const module of coreSelection) {
    if (!isCoreTenantModule(module)) {
      continue;
    }
    enabled.add(module);
    for (const bundled of bundledModulesForCore(module)) {
      enabled.add(bundled);
    }
  }
  return ALL_TENANT_MODULES.filter((m) => enabled.has(m));
}

export function buildInstitutionModulePairs(
  coreSelection: TenantModule[],
): { module: TenantModule; enabled: boolean }[] {
  const enabled = new Set(resolveModulesFromCoreSelection(coreSelection));
  return ALL_TENANT_MODULES.map((module) => ({
    module,
    enabled: enabled.has(module),
  }));
}
