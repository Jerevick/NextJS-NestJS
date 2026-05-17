import {
  programmeDurationCapYears,
  classifyBatchRecommendation,
  isAdmissionBeyondDurationCap,
} from './progression-batch-eval';

describe('progression-batch-eval', () => {
  it('computes duration cap from rule or programme length', () => {
    expect(programmeDurationCapYears(null, 4)).toBe(6);
    expect(programmeDurationCapYears(8, 4)).toBe(8);
  });

  it('detects exceeded duration', () => {
    const anchorOld = new Date(Date.UTC(2015, 0, 1));
    expect(isAdmissionBeyondDurationCap(anchorOld, 6, Date.UTC(2026, 0, 1))).toBe(true);
    const anchorRecent = new Date(Date.UTC(2025, 0, 1));
    expect(isAdmissionBeyondDurationCap(anchorRecent, 6, Date.UTC(2026, 0, 1))).toBe(false);
  });

  it('classifies automatic promotion when GPA meets minimum', () => {
    expect(
      classifyBatchRecommendation({
        cumulativeGpa: 3.5,
        minGpaPromotion: 2,
        conditionalPromotionMinGpa: null,
        durationExceeded: false,
        hasProgressionRule: true,
      }),
    ).toBe('AUTOMATIC_PROMOTION');
  });

  it('max duration blocks promotion even with high GPA', () => {
    expect(
      classifyBatchRecommendation({
        cumulativeGpa: 4,
        minGpaPromotion: 2,
        conditionalPromotionMinGpa: null,
        durationExceeded: true,
        hasProgressionRule: true,
      }),
    ).toBe('MAX_DURATION_BLOCK');
  });
});
