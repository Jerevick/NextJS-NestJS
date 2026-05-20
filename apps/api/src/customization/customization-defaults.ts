/** UniCore platform defaults — lowest priority in settings cascade. */
export const PLATFORM_SETTING_DEFAULTS: Record<string, unknown> = {
  'branding.primaryColor': '#1e3a5f',
  'branding.logoUrl': null,
  'branding.customDomain': null,
  studentNumberFormat: 'EXT/{year}/[SEQ:4]',
  'grading.system': 'PERCENTAGE',
  'academic.semesterLabels': ['Semester 1', 'Semester 2'],
  'academic.calendarOffsetDays': 0,
  'academic.calendar': { termStartOffsets: [] },
  'notifications.digestMode': false,
  'integrations.zoom': { enabled: false },
  'integrations.whatsapp': { enabled: false },
  'integrations.calendar': { provider: 'none' },
  paymentGateway: 'noop',
};

/**
 * Keys entities may override (institution sets ceiling / defaults).
 * Maps to master prompt §14.2 entity-customisable settings.
 */
export const ENTITY_OVERRIDABLE_KEYS = new Set([
  // Branding
  'branding.primaryColor',
  'branding.logoUrl',
  'branding.customDomain',
  'logoUrl',
  'primaryColor',
  'customDomain',
  // Academic
  'studentNumberFormat',
  'grading.system',
  'academic.semesterLabels',
  'academic.calendarOffsetDays',
  'academic.calendar',
  // Finance
  'paymentGateway',
  'finance.feeStructures',
  // Modules (subset of institution modules)
  'modules',
]);

/**
 * Institution-only — entities cannot override (master prompt §14.2).
 * Matched by exact key or root segment (e.g. `billing.plan` → `billing`).
 */
export const INSTITUTION_ONLY_KEYS = new Set([
  // Authentication (SSO, MFA)
  'auth',
  'auth.sso',
  'auth.mfa',
  'oauthGoogle',
  'mfa',
  'sso',
  // Data retention & audit
  'dataRetention',
  'audit',
  'auditLog',
  // Subscription / billing (institution contract)
  'billing',
  'subscription',
  'payment.credentials',
]);
