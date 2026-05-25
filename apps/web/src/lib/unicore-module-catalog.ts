/** Tenant modules (matches API `TenantModule` enum). */
export const TENANT_MODULE_IDS = [
  'SIS',
  'LMS',
  'FINANCE',
  'HR',
  'ELECTIONS',
  'ALUMNI',
  'SPORTS',
  'MEETINGS',
] as const;

export type TenantModuleId = (typeof TENANT_MODULE_IDS)[number];

/** Core packages — the only modules selectable on registration. */
export const CORE_PACKAGE_IDS = ['SIS', 'LMS'] as const;

export type CorePackageId = (typeof CORE_PACKAGE_IDS)[number];

export type RegistrationModuleId = CorePackageId;

export type ModulePackageTier = 'core' | 'outOfBox';

export type BundledWithCore = 'SIS' | 'LMS';

export type UnicoreModuleOption = {
  id: TenantModuleId;
  label: string;
  description: string;
  tier: ModulePackageTier;
  /** Set for out-of-the-box modules that ship with a core package. */
  bundledWith?: BundledWithCore;
};

export const UNICORE_MODULE_CATALOG: readonly UnicoreModuleOption[] = [
  {
    id: 'SIS',
    tier: 'core',
    label: 'Student Information System',
    description:
      'Admissions, enrollment, student records, progression, transcripts, and registrar workflows with full audit trails.',
  },
  {
    id: 'LMS',
    tier: 'core',
    label: 'Learning Management',
    description:
      'Course delivery, lessons, assessments, gradebook, and syllabus-aware AI tutoring for enrolled learners.',
  },
  {
    id: 'FINANCE',
    tier: 'outOfBox',
    bundledWith: 'SIS',
    label: 'Finance & billing',
    description:
      'Fee structures, payment gateways, scholarships, and student accounts tied to enrollment.',
  },
  {
    id: 'HR',
    tier: 'outOfBox',
    bundledWith: 'SIS',
    label: 'HR & staff',
    description: 'Staff profiles, leave, appraisals, workload planning, and organisation charts.',
  },
  {
    id: 'ELECTIONS',
    tier: 'outOfBox',
    bundledWith: 'SIS',
    label: 'Elections',
    description:
      'Campus elections with blind voting, eligibility rules, and secure ballot handling.',
  },
  {
    id: 'ALUMNI',
    tier: 'outOfBox',
    bundledWith: 'SIS',
    label: 'Alumni & mentorship',
    description: 'Alumni directory, mentorship matching, and post-graduation engagement.',
  },
  {
    id: 'SPORTS',
    tier: 'outOfBox',
    bundledWith: 'SIS',
    label: 'Sports & facilities',
    description: 'Teams, fixtures, facility bookings, and GPA-based athlete eligibility.',
  },
  {
    id: 'MEETINGS',
    tier: 'outOfBox',
    bundledWith: 'SIS',
    label: 'Meetings',
    description: 'Committee meetings, agendas, minutes capture, and optional AI-assisted drafting.',
  },
] as const;

export const CORE_PACKAGE_CATALOG = UNICORE_MODULE_CATALOG.filter((m) => m.tier === 'core');

export const MODULES_BUNDLED_WITH_SIS = UNICORE_MODULE_CATALOG.filter(
  (m) => m.bundledWith === 'SIS',
);

export const MODULES_BUNDLED_WITH_LMS = UNICORE_MODULE_CATALOG.filter(
  (m) => m.bundledWith === 'LMS',
);

export function resolveModulesFromCoreSelection(
  coreSelection: readonly CorePackageId[],
): TenantModuleId[] {
  const enabled = new Set<TenantModuleId>();
  for (const core of coreSelection) {
    enabled.add(core);
    const bundled = core === 'SIS' ? MODULES_BUNDLED_WITH_SIS : MODULES_BUNDLED_WITH_LMS;
    for (const mod of bundled) {
      enabled.add(mod.id);
    }
  }
  return TENANT_MODULE_IDS.filter((id) => enabled.has(id));
}

export function formatModulesForDisplay(ids: TenantModuleId[]): string {
  const labels = ids.map((id) => UNICORE_MODULE_CATALOG.find((m) => m.id === id)?.label ?? id);
  return labels.join(', ');
}
