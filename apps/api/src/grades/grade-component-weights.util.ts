import { BadRequestException } from '@nestjs/common';

export type GradeComponentWeightBand = { key: string; label: string; weight: number };

type SettingsRoot = {
  grades?: {
    /** Weighted grade components; weights should sum to ~1. Scores are 0–100 per component. */
    componentWeights?: unknown;
  };
};

const WEIGHT_SUM_EPS = 0.02;

function readString(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

/**
 * Validates and normalizes **`componentWeights`** for persistence (PATCH from registrar UI).
 * - **`[]`** clears configured weights (grade entry falls back to single score column).
 * - Non-empty arrays must have unique keys, valid weights ∈ (0,1], and sum ≈ **1**.
 */
export function assertGradeComponentBandsForPersist(raw: unknown): GradeComponentWeightBand[] {
  if (!Array.isArray(raw)) {
    throw new BadRequestException(
      'componentWeights must be an array (use [] to disable weighted entry).',
    );
  }
  if (raw.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const bands: GradeComponentWeightBand[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new BadRequestException(
        `componentWeights[${i}] must be an object with key, weight, optional label.`,
      );
    }
    const rec = item as Record<string, unknown>;
    const key = readString(rec.key);
    if (!key) {
      throw new BadRequestException(`componentWeights[${i}]: key is required.`);
    }
    if (seen.has(key)) {
      throw new BadRequestException(`Duplicate grade component key "${key}".`);
    }
    const w = Number(rec.weight);
    if (!Number.isFinite(w) || w <= 0 || w > 1) {
      throw new BadRequestException(
        `componentWeights (${key}): weight must be a number strictly between 0 and 1.`,
      );
    }
    const label = readString(rec.label) ?? key;
    seen.add(key);
    bands.push({ key, label, weight: w });
  }
  const sum = bands.reduce((acc, b) => acc + b.weight, 0);
  if (Math.abs(sum - 1) > WEIGHT_SUM_EPS) {
    throw new BadRequestException(
      `Component weights must sum to 1.0 (100%). Current sum is ${sum.toFixed(4)}. Adjust decimals (e.g. 0.35 + 0.35 + 0.30).`,
    );
  }
  return bands;
}

/**
 * Reads `Institution.settings.grades.componentWeights`. Returns [] if missing or invalid
 * (misconfigured institutions fall back to free-form grade JSON without auto weighting).
 */
export function parseGradeComponentWeights(settings: unknown): GradeComponentWeightBand[] {
  const root = (settings ?? {}) as SettingsRoot;
  const raw = root.grades?.componentWeights;
  if (!Array.isArray(raw) || raw.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const bands: GradeComponentWeightBand[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const rec = item as Record<string, unknown>;
    const key = readString(rec.key);
    if (!key || seen.has(key)) {
      continue;
    }
    const w = Number(rec.weight);
    if (!Number.isFinite(w) || w < 0 || w > 1) {
      continue;
    }
    const label = readString(rec.label) ?? key;
    seen.add(key);
    bands.push({ key, label, weight: w });
  }
  if (bands.length === 0) {
    return [];
  }
  const sum = bands.reduce((acc, b) => acc + b.weight, 0);
  if (Math.abs(sum - 1) > WEIGHT_SUM_EPS) {
    return [];
  }
  return bands;
}

export function weightedScoreFromComponents(
  bands: GradeComponentWeightBand[],
  scores: Record<string, number>,
): number {
  let acc = 0;
  for (const b of bands) {
    acc += b.weight * scores[b.key]!;
  }
  return Math.round(acc * 1000) / 1000;
}

/**
 * Validates each configured component is present with a numeric 0–100 score.
 */
export function assertValidComponentScores(
  bands: GradeComponentWeightBand[],
  raw: Record<string, unknown>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const b of bands) {
    const v = raw[b.key];
    const n =
      typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.trim()) : NaN;
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      throw new BadRequestException(
        `Component "${b.label}" (${b.key}) must be a numeric score between 0 and 100.`,
      );
    }
    out[b.key] = n;
  }
  for (const k of Object.keys(raw)) {
    if (!bands.some((b) => b.key === k)) {
      throw new BadRequestException(`Unknown grade component key: ${k}`);
    }
  }
  return out;
}

export function sanitizeFreeformComponents(raw: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof k !== 'string' || !k.trim()) {
      continue;
    }
    const n =
      typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.trim()) : NaN;
    if (Number.isFinite(n)) {
      out[k.trim()] = n;
    }
  }
  return out;
}
