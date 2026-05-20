import { TenantModule } from '@prisma/client';
import {
  MODULES_BUNDLED_WITH_LMS,
  MODULES_BUNDLED_WITH_SIS,
  buildInstitutionModulePairs,
  resolveModulesFromCoreSelection,
} from './tenant-module-packages';

describe('tenant-module-packages', () => {
  it('bundles SIS out-of-the-box modules with SIS only', () => {
    const modules = resolveModulesFromCoreSelection([TenantModule.SIS]);
    expect(modules).toContain(TenantModule.SIS);
    for (const m of MODULES_BUNDLED_WITH_SIS) {
      expect(modules).toContain(m);
    }
    expect(modules).not.toContain(TenantModule.LMS);
    expect(modules).not.toContain(TenantModule.MEETINGS);
  });

  it('bundles LMS out-of-the-box modules with LMS only', () => {
    const modules = resolveModulesFromCoreSelection([TenantModule.LMS]);
    expect(modules).toContain(TenantModule.LMS);
    for (const m of MODULES_BUNDLED_WITH_LMS) {
      expect(modules).toContain(m);
    }
    expect(modules).not.toContain(TenantModule.SIS);
    expect(modules).not.toContain(TenantModule.FINANCE);
  });

  it('merges bundles when both core packages are selected', () => {
    const modules = resolveModulesFromCoreSelection([TenantModule.SIS, TenantModule.LMS]);
    expect(modules).toHaveLength(8);
  });

  it('buildInstitutionModulePairs marks non-selected modules disabled', () => {
    const pairs = buildInstitutionModulePairs([TenantModule.SIS]);
    expect(pairs.find((p) => p.module === TenantModule.FINANCE)?.enabled).toBe(true);
    expect(pairs.find((p) => p.module === TenantModule.LMS)?.enabled).toBe(false);
  });
});
