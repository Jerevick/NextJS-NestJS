/** Institution settings path: `settings.integrations.sisLmsBridge` */

export type SisLmsBridgeSettings = {
  /** Both SIS and LMS modules are on and share enrollment → course access. */
  enabled: boolean;
  /** Student LMS routes require an ACTIVE SIS enrollment in the linked section. */
  enrollmentLinkedAccess: boolean;
  /** New LMS assessments may pass grades back to SIS enrollments by default. */
  gradePassbackDefault: boolean;
};

const DEFAULT_BRIDGE: SisLmsBridgeSettings = {
  enabled: false,
  enrollmentLinkedAccess: true,
  gradePassbackDefault: true,
};

export function readSisLmsBridgeSettings(settings: unknown): SisLmsBridgeSettings {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return { ...DEFAULT_BRIDGE };
  }
  const integrations = (settings as Record<string, unknown>).integrations;
  if (!integrations || typeof integrations !== 'object' || Array.isArray(integrations)) {
    return { ...DEFAULT_BRIDGE };
  }
  const raw = (integrations as Record<string, unknown>).sisLmsBridge;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_BRIDGE };
  }
  const b = raw as Record<string, unknown>;
  return {
    enabled: b.enabled === true,
    enrollmentLinkedAccess: b.enrollmentLinkedAccess !== false,
    gradePassbackDefault: b.gradePassbackDefault !== false,
  };
}

export function buildSisLmsBridgeWhenBothModules(
  sisEnabled: boolean,
  lmsEnabled: boolean,
): SisLmsBridgeSettings {
  if (!sisEnabled || !lmsEnabled) {
    return { ...DEFAULT_BRIDGE, enabled: false };
  }
  return {
    enabled: true,
    enrollmentLinkedAccess: true,
    gradePassbackDefault: true,
  };
}

export function mergeSisLmsBridgeIntoSettings(
  settings: unknown,
  bridge: SisLmsBridgeSettings,
): Record<string, unknown> {
  const base =
    settings && typeof settings === 'object' && !Array.isArray(settings)
      ? { ...(settings as Record<string, unknown>) }
      : {};
  const integrations =
    base.integrations && typeof base.integrations === 'object' && !Array.isArray(base.integrations)
      ? { ...(base.integrations as Record<string, unknown>) }
      : {};
  return {
    ...base,
    integrations: {
      ...integrations,
      sisLmsBridge: bridge,
    },
  };
}
