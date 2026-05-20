import {
  ENTITY_OVERRIDABLE_KEYS,
  INSTITUTION_ONLY_KEYS,
  PLATFORM_SETTING_DEFAULTS,
} from './customization-defaults';

/** Flatten nested patch objects into dotted paths for validation. */
export function flattenPatchKeys(patch: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [segment, value] of Object.entries(patch)) {
    const path = prefix ? `${prefix}.${segment}` : segment;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenPatchKeys(value as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

/** True when entity must not supply a value (institution or platform only). */
export function isInstitutionOnlyKey(key: string): boolean {
  if (INSTITUTION_ONLY_KEYS.has(key)) {
    return true;
  }
  const root = key.split('.')[0] ?? key;
  return INSTITUTION_ONLY_KEYS.has(root);
}

export type SettingSource = 'entity' | 'institution' | 'platform';

export type EffectiveSettingResult<T = unknown> = {
  key: string;
  value: T;
  source: SettingSource;
};

export function getNestedValue(obj: unknown, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object' || Array.isArray(cur)) {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const parts = path.split('.');
  if (parts.length === 1) {
    return { ...obj, [path]: value };
  }
  const [head, ...rest] = parts;
  const child =
    obj[head] && typeof obj[head] === 'object' && !Array.isArray(obj[head])
      ? { ...(obj[head] as Record<string, unknown>) }
      : {};
  return {
    ...obj,
    [head]: setNestedValue(child, rest.join('.'), value),
  };
}

export function mergeSettingsPatch(
  existing: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  let out = base;
  for (const [key, value] of Object.entries(patch)) {
    if (
      value !== undefined &&
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      const prev = getNestedValue(out, key);
      const merged =
        prev && typeof prev === 'object' && !Array.isArray(prev)
          ? { ...(prev as Record<string, unknown>), ...(value as Record<string, unknown>) }
          : value;
      out = setNestedValue(out, key, merged);
    } else {
      out = setNestedValue(out, key, value);
    }
  }
  return out;
}

/** Legacy/top-level entity JSON paths mapped to dotted setting keys. */
const ENTITY_SETTING_ALIASES: Record<string, string[]> = {
  'branding.logoUrl': ['logoUrl'],
  'branding.primaryColor': ['primaryColor'],
  'branding.customDomain': ['customDomain'],
  paymentGateway: ['paymentGateway'],
};

function readEntitySettingValue(entitySettings: unknown, key: string): unknown {
  const direct = getNestedValue(entitySettings, key);
  if (direct !== undefined) {
    return direct;
  }
  const aliases = ENTITY_SETTING_ALIASES[key];
  if (!aliases || !entitySettings) {
    return undefined;
  }
  for (const alt of aliases) {
    const v = getNestedValue(entitySettings, alt);
    if (v !== undefined) {
      return v;
    }
  }
  return undefined;
}

export function resolveEffectiveSetting<T = unknown>(
  key: string,
  institutionSettings: unknown,
  entitySettings?: unknown,
): EffectiveSettingResult<T> {
  const entityVal =
    entitySettings && !isInstitutionOnlyKey(key)
      ? readEntitySettingValue(entitySettings, key)
      : undefined;
  if (entityVal !== undefined) {
    return { key, value: entityVal as T, source: 'entity' };
  }
  const instVal = getNestedValue(institutionSettings, key);
  if (instVal !== undefined) {
    return { key, value: instVal as T, source: 'institution' };
  }
  const platformVal = PLATFORM_SETTING_DEFAULTS[key];
  return {
    key,
    value: (platformVal !== undefined ? platformVal : null) as T,
    source: 'platform',
  };
}

export function assertEntityMayOverride(key: string): void {
  if (isInstitutionOnlyKey(key)) {
    throw new Error(
      `Setting "${key}" is institution-only (auth, retention, audit, billing) and cannot be set per campus`,
    );
  }
  const root = key.split('.')[0] ?? key;
  if (!ENTITY_OVERRIDABLE_KEYS.has(key) && !ENTITY_OVERRIDABLE_KEYS.has(root)) {
    throw new Error(`Setting "${key}" is not entity-customisable`);
  }
}

/** Keys institution admins manage; never returned as entity-overridable in catalog. */
export const INSTITUTION_ONLY_CATALOG = [
  { key: 'auth / oauthGoogle', label: 'Authentication (SSO, MFA)', group: 'security' },
  { key: 'dataRetention', label: 'Data retention policies', group: 'compliance' },
  { key: 'audit', label: 'Audit log settings', group: 'compliance' },
  { key: 'billing / subscription', label: 'Subscription & billing', group: 'billing' },
] as const;

export function maskSecretValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  const lower = key.toLowerCase();
  if (
    lower.includes('apikey') ||
    lower.includes('secret') ||
    lower.includes('password') ||
    lower.includes('token')
  ) {
    if (typeof value === 'string' && value.length > 4) {
      return `${value.slice(0, 4)}${'•'.repeat(Math.min(12, value.length - 4))}`;
    }
    return '••••••••';
  }
  if (
    (lower.includes('payment') || lower.includes('credential')) &&
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  ) {
    const o = { ...(value as Record<string, unknown>) };
    for (const k of Object.keys(o)) {
      const child = o[k];
      if (child && typeof child === 'object' && !Array.isArray(child)) {
        o[k] = maskSecretValue(k, child);
      } else if (/key|secret|token/i.test(k) && typeof child === 'string') {
        o[k] = maskSecretValue(k, child);
      }
    }
    return o;
  }
  return value;
}

export const SETTINGS_CATALOG = [
  { key: 'branding.primaryColor', label: 'Primary brand colour', group: 'branding' },
  { key: 'branding.logoUrl', label: 'Logo URL', group: 'branding' },
  { key: 'branding.customDomain', label: 'Custom domain', group: 'branding' },
  { key: 'studentNumberFormat', label: 'Student number format', group: 'academic' },
  { key: 'grading.system', label: 'Grading system (PERCENTAGE | GPA)', group: 'academic' },
  { key: 'academic.semesterLabels', label: 'Semester display names', group: 'academic' },
  { key: 'academic.calendarOffsetDays', label: 'Calendar offset (days)', group: 'academic' },
  { key: 'academic.calendar', label: 'Academic calendar overrides', group: 'academic' },
  { key: 'paymentGateway', label: 'Payment gateway provider', group: 'payment' },
  { key: 'modules', label: 'Enabled modules (entity subset)', group: 'modules' },
  { key: 'integrations.zoom', label: 'Zoom integration', group: 'integrations' },
  { key: 'integrations.whatsapp', label: 'WhatsApp integration', group: 'integrations' },
  { key: 'integrations.calendar', label: 'Calendar sync', group: 'integrations' },
] as const;
