import { decryptSensitiveJson, encryptSensitiveJson } from '../common/crypto/field-encryption';
import type { AIProvider } from './providers/ai-provider.interface';

export type InstitutionAiSettings = {
  aiProvider?: 'openai' | 'anthropic';
  openaiApiKey?: string;
  anthropicApiKey?: string;
  dailyTokenLimit?: number;
  tutorDailyTokenLimit?: number;
};

export function readInstitutionAiSettings(settings: unknown): InstitutionAiSettings {
  const raw = (settings ?? {}) as Record<string, unknown>;
  const ai = (raw.ai ?? raw) as Record<string, unknown>;
  const keys = ai.keys as unknown;
  let openaiApiKey: string | undefined;
  let anthropicApiKey: string | undefined;
  if (keys && typeof keys === 'object') {
    const decrypted = decryptSensitiveJson(keys);
    if (decrypted && typeof decrypted === 'object') {
      const k = decrypted as Record<string, string>;
      openaiApiKey = k.openaiApiKey;
      anthropicApiKey = k.anthropicApiKey;
    }
  }
  return {
    aiProvider: ai.aiProvider as InstitutionAiSettings['aiProvider'],
    openaiApiKey,
    anthropicApiKey,
    dailyTokenLimit: typeof ai.dailyTokenLimit === 'number' ? ai.dailyTokenLimit : undefined,
    tutorDailyTokenLimit:
      typeof ai.tutorDailyTokenLimit === 'number' ? ai.tutorDailyTokenLimit : undefined,
  };
}

export function packInstitutionAiKeys(keys: {
  openaiApiKey?: string;
  anthropicApiKey?: string;
}): Record<string, unknown> {
  return encryptSensitiveJson(keys) as unknown as Record<string, unknown>;
}

export type ResolvedAiCredentials = {
  providerName: AIProvider['name'];
  openaiApiKey?: string;
  anthropicApiKey?: string;
  dailyTokenLimit?: number;
};
