/** Stored on `InstitutionEntity.settings` (JSON). */
export type EntityCoupling = 'INTERNAL' | 'PARTIAL' | 'EXTERNAL';

export type EntityBillingClassification =
  | 'BILLED_TO_PARENT'
  | 'BILLED_INDEPENDENTLY'
  | 'EXEMPT';

export interface InstitutionEntitySettings {
  shortName?: string;
  description?: string;
  location?: string;
  logoUrl?: string;
  primaryColor?: string;
  customDomain?: string;
  coupling?: EntityCoupling;
  billingClassification?: EntityBillingClassification;
  modules?: string[];
  academic?: Record<string, unknown>;
  provisioningLog?: string[];
  provisionedAt?: string;
  suspendReason?: string;
  suspendedAt?: string;
}

export function parseEntitySettings(raw: unknown): InstitutionEntitySettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  return raw as InstitutionEntitySettings;
}

export function mergeEntitySettings(
  current: unknown,
  patch: InstitutionEntitySettings,
): InstitutionEntitySettings {
  const base = parseEntitySettings(current);
  return {
    ...base,
    ...patch,
    academic:
      patch.academic !== undefined
        ? { ...(base.academic ?? {}), ...patch.academic }
        : base.academic,
  };
}
