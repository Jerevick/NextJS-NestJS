/** Optional nested object on `LmsAssessment.settings`: `{ sisPassback: { enabled?, componentKey? } }`. */
export type LmsAssessmentSisPassback = {
  enabled: boolean;
  /** Must match configured grade component key when weighted components exist. Defaults to **`lms`**. */
  componentKey: string;
};

export function readLmsAssessmentSisPassback(settings: unknown): LmsAssessmentSisPassback {
  const s = (settings ?? {}) as Record<string, unknown>;
  const raw = (s.sisPassback ?? {}) as Record<string, unknown>;
  const enabled = raw.enabled === true;
  const ck =
    typeof raw.componentKey === 'string' && raw.componentKey.trim().length > 0
      ? raw.componentKey.trim()
      : 'lms';
  return { enabled, componentKey: ck };
}

export function clampPercentScore(n: number): number {
  return Math.round(Math.min(100, Math.max(0, n)) * 1000) / 1000;
}

/**
 * Normalize LMS submission **`grade`** JSON into a single 0–100 score for **`StudentEnrollment.grade`**.
 * Supports **`score`**, **`percentScore`**, and auto-grade payloads with **`earned`** (over normalized total).
 */
export function deriveEnrollmentPercentScoreFromSubmissionGrade(
  grade: unknown,
  assessmentTotalPoints: number,
): number | null {
  if (!Number.isFinite(assessmentTotalPoints) || assessmentTotalPoints <= 0) {
    return null;
  }
  if (!grade || typeof grade !== 'object' || Array.isArray(grade)) {
    return null;
  }
  const g = grade as Record<string, unknown>;
  if (typeof g.score === 'number' && Number.isFinite(g.score)) {
    const raw = g.score;
    if (raw >= 0 && raw <= 1) {
      return clampPercentScore(raw * 100);
    }
    return clampPercentScore(
      raw <= 100 ? raw : raw > assessmentTotalPoints ? 100 : (raw / assessmentTotalPoints) * 100,
    );
  }
  if (typeof g.percentScore === 'number' && Number.isFinite(g.percentScore)) {
    return clampPercentScore(g.percentScore);
  }
  if (typeof g.earned === 'number' && Number.isFinite(g.earned)) {
    const denom =
      typeof g.assessmentTotalPoints === 'number' &&
      Number.isFinite(g.assessmentTotalPoints) &&
      g.assessmentTotalPoints > 0
        ? g.assessmentTotalPoints
        : typeof g.maxMcqPoints === 'number' &&
            Number.isFinite(g.maxMcqPoints) &&
            g.maxMcqPoints > 0
          ? g.maxMcqPoints
          : assessmentTotalPoints;
    if (denom <= 0) {
      return null;
    }
    return clampPercentScore((g.earned / denom) * 100);
  }
  return null;
}

type ScaleBand = { min: number; max: number; letter: string; points: number };

function parseScaleBands(scale: unknown): ScaleBand[] {
  if (!Array.isArray(scale)) {
    return [];
  }
  const out: ScaleBand[] = [];
  for (const row of scale) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const r = row as Record<string, unknown>;
    const min = Number(r.min);
    const max = Number(r.max);
    const letter = r.letter;
    const points = Number(r.points);
    if (
      Number.isFinite(min) &&
      Number.isFinite(max) &&
      typeof letter === 'string' &&
      letter.length > 0 &&
      Number.isFinite(points)
    ) {
      out.push({ min, max, letter, points });
    }
  }
  return out;
}

function mapScoreToLetterPoints(
  score: number,
  bands: ScaleBand[],
): { letter: string; points: number } | null {
  for (const b of bands) {
    if (score >= b.min && score <= b.max) {
      return { letter: b.letter, points: b.points };
    }
  }
  return null;
}

/** Read prior component scores safely for weighted merge during LMS passback. */
export function mergePrevComponentScores(prev: Record<string, unknown>): Record<string, number> {
  const rawComps = prev.components;
  if (!rawComps || typeof rawComps !== 'object' || Array.isArray(rawComps)) {
    return {};
  }
  const obj = rawComps as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) {
    const n =
      typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.trim()) : NaN;
    if (typeof k === 'string' && k.trim() && Number.isFinite(n) && n >= 0 && n <= 100) {
      out[k.trim()] = Math.round(n * 1000) / 1000;
    }
  }
  return out;
}

/** Derive letter grade + points using default institution scale bands when **`letterGrade`** is not set. */
export function applyLetterMappingFromNumeric(
  enrollmentGrade: Record<string, unknown>,
  numericScore: number,
  gradingScaleCsv: unknown,
): Record<string, unknown> {
  if (typeof enrollmentGrade.letterGrade === 'string' && enrollmentGrade.letterGrade.length > 0) {
    return enrollmentGrade;
  }
  const bands = parseScaleBands(gradingScaleCsv);
  const mapped =
    numericScore !== undefined && Number.isFinite(numericScore) && bands.length
      ? mapScoreToLetterPoints(numericScore, bands)
      : null;
  const next = { ...enrollmentGrade };
  if (mapped) {
    next.letterGrade = mapped.letter;
    next.gradePoints = mapped.points;
  }
  return next;
}
