export type EntityCoupling = 'INTERNAL' | 'PARTIAL' | 'EXTERNAL';

export type EntityBillingClassification =
  | 'BILLED_TO_PARENT'
  | 'BILLED_INDEPENDENTLY'
  | 'EXEMPT';

export interface ParsedEntitySettings {
  coupling?: EntityCoupling;
  billingClassification?: EntityBillingClassification;
  shortName?: string;
  description?: string;
  location?: string;
}

export function parseEntitySettings(raw: unknown): ParsedEntitySettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const o = raw as Record<string, unknown>;
  return {
    coupling: o.coupling as EntityCoupling | undefined,
    billingClassification: o.billingClassification as EntityBillingClassification | undefined,
    shortName: typeof o.shortName === 'string' ? o.shortName : undefined,
    description: typeof o.description === 'string' ? o.description : undefined,
    location: typeof o.location === 'string' ? o.location : undefined,
  };
}
