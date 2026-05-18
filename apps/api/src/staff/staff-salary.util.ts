import type { Prisma } from '@prisma/client';
import { decryptSensitiveJson, encryptSensitiveJson } from '../common/crypto/field-encryption';

export type StaffSalaryPlain = {
  amount: number;
  currency: string;
  effectiveDate?: string;
};

export function encryptSalary(salary: StaffSalaryPlain): Prisma.InputJsonValue {
  return encryptSensitiveJson(salary) as Prisma.InputJsonValue;
}

export function decryptSalary(stored: unknown): StaffSalaryPlain | null {
  const decoded = decryptSensitiveJson(stored);
  if (!decoded || typeof decoded !== 'object') return null;
  const o = decoded as Record<string, unknown>;
  if (typeof o.amount !== 'number') return null;
  return {
    amount: o.amount,
    currency: typeof o.currency === 'string' ? o.currency : 'USD',
    effectiveDate: typeof o.effectiveDate === 'string' ? o.effectiveDate : undefined,
  };
}
