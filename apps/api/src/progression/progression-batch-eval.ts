/** Pure helpers for semester-close progression batch (Prompt 19.1). */

export type BatchRecommendation =
  | 'AUTOMATIC_PROMOTION'
  | 'CONDITIONAL_REVIEW'
  | 'REPEAT_ADVISED'
  | 'MAX_DURATION_BLOCK'
  | 'NO_PROGRESSION_RULE'
  | 'INSUFFICIENT_GRADE_DATA';

export function programmeDurationCapYears(
  ruleMaxYears: number | null | undefined,
  programDurationYears: number,
): number {
  return ruleMaxYears ?? Math.max(1, Math.ceil(Number(programDurationYears) * 1.5));
}

export function isAdmissionBeyondDurationCap(
  admissionDate: Date,
  capYears: number,
  nowMs = Date.now(),
): boolean {
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  const yearsElapsed = (nowMs - admissionDate.getTime()) / msPerYear;
  return yearsElapsed > capYears;
}

/**
 * Classifies a student after cumulative GPA is computed with repeat policy.
 */
export function classifyBatchRecommendation(args: {
  cumulativeGpa: number | null;
  minGpaPromotion: number | undefined | null;
  conditionalPromotionMinGpa: number | undefined | null;
  durationExceeded: boolean;
  hasProgressionRule: boolean;
}): BatchRecommendation {
  if (!args.hasProgressionRule) {
    return 'NO_PROGRESSION_RULE';
  }
  if (args.durationExceeded) {
    return 'MAX_DURATION_BLOCK';
  }
  const minP = args.minGpaPromotion;
  const cond = args.conditionalPromotionMinGpa;
  if ((minP === null || minP === undefined) && (cond === null || cond === undefined)) {
    return 'INSUFFICIENT_GRADE_DATA';
  }
  if (args.cumulativeGpa === null) {
    return 'INSUFFICIENT_GRADE_DATA';
  }
  const gpa = args.cumulativeGpa;
  if (minP !== null && minP !== undefined && gpa >= minP) {
    return 'AUTOMATIC_PROMOTION';
  }
  if (cond !== null && cond !== undefined && gpa >= cond) {
    return 'CONDITIONAL_REVIEW';
  }
  if (minP !== null && minP !== undefined && gpa < minP) {
    return 'REPEAT_ADVISED';
  }
  if (cond !== null && cond !== undefined && gpa < cond) {
    return 'REPEAT_ADVISED';
  }
  return 'INSUFFICIENT_GRADE_DATA';
}
