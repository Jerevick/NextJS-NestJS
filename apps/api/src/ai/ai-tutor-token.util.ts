import type { PlanTier } from '@prisma/client';
import { readInstitutionAiSettings } from './ai-institution-settings';

const PLAN_DEFAULT_TUTOR_DAILY_TOKENS: Record<PlanTier, number> = {
  STARTER: 8_000,
  GROWTH: 25_000,
  ENTERPRISE: 100_000,
};

export function resolveTutorDailyTokenLimit(
  institutionSettings: unknown,
  plan: PlanTier,
): number | null {
  const configured = readInstitutionAiSettings(institutionSettings).tutorDailyTokenLimit;
  if (configured != null && configured > 0) return configured;
  return PLAN_DEFAULT_TUTOR_DAILY_TOKENS[plan] ?? null;
}
