export type GuardianPortalVisibility = {
  academic: boolean;
  finance: boolean;
  attendance: boolean;
};

function readBool(obj: unknown, key: string, fallback: boolean): boolean {
  if (!obj || typeof obj !== 'object') {
    return fallback;
  }
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === 'boolean' ? v : fallback;
}

/** Resolve guardian portal visibility from institution / entity settings JSON. */
export function resolveGuardianPortalVisibility(
  institutionSettings: unknown,
  entitySettings?: unknown,
): GuardianPortalVisibility {
  const inst =
    institutionSettings && typeof institutionSettings === 'object'
      ? (institutionSettings as Record<string, unknown>).guardianPortal
      : undefined;
  const ent =
    entitySettings && typeof entitySettings === 'object'
      ? (entitySettings as Record<string, unknown>).guardianPortal
      : undefined;

  const merged = {
    ...(inst && typeof inst === 'object' ? (inst as Record<string, unknown>) : {}),
    ...(ent && typeof ent === 'object' ? (ent as Record<string, unknown>) : {}),
  };

  return {
    academic: readBool(merged, 'academic', true),
    finance: readBool(merged, 'finance', true),
    attendance: readBool(merged, 'attendance', true),
  };
}
