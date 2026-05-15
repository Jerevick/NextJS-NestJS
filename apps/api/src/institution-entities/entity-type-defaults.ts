import { InstitutionEntityType } from '@prisma/client';
import type {
  EntityBillingClassification,
  EntityCoupling,
  InstitutionEntitySettings,
} from './entity-settings.types';

export function defaultCouplingForType(type: InstitutionEntityType): EntityCoupling {
  if (type === 'AFFILIATE') {
    return 'EXTERNAL';
  }
  if (type === 'CONSTITUENT_COLLEGE') {
    return 'PARTIAL';
  }
  return 'INTERNAL';
}

export function defaultBillingForType(type: InstitutionEntityType): EntityBillingClassification {
  if (type === 'AFFILIATE') {
    return 'BILLED_INDEPENDENTLY';
  }
  if (type === 'RESEARCH_INSTITUTE' || type === 'SUMMER_SCHOOL') {
    return 'EXEMPT';
  }
  return 'BILLED_TO_PARENT';
}

export function defaultSettingsForType(type: InstitutionEntityType): InstitutionEntitySettings {
  return {
    coupling: defaultCouplingForType(type),
    billingClassification: defaultBillingForType(type),
    modules: defaultModulesForType(type),
    provisioningLog: [],
  };
}

function defaultModulesForType(type: InstitutionEntityType): string[] {
  const base = ['SIS', 'LMS'];
  if (type === 'AFFILIATE') {
    return [];
  }
  if (type === 'RESEARCH_INSTITUTE') {
    return ['SIS'];
  }
  return base;
}

export function assertAffiliateCoupling(coupling: EntityCoupling | undefined, type: InstitutionEntityType): void {
  if (type === 'AFFILIATE' && coupling !== undefined && coupling !== 'EXTERNAL') {
    throw new Error('AFFILIATE entities must use EXTERNAL coupling');
  }
}
