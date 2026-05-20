import { buildRuleBasedAcademicTip } from './portal-academic-tip.util';

describe('buildRuleBasedAcademicTip', () => {
  it('prioritises low attendance courses', () => {
    const tip = buildRuleBasedAcademicTip({
      lowestAttendance: { courseCode: 'MATH301', ratePercent: 61 },
      dueSoonCount: 3,
    });
    expect(tip).toContain('MATH301');
    expect(tip).toContain('61%');
  });

  it('falls back to due-soon message', () => {
    const tip = buildRuleBasedAcademicTip({ dueSoonCount: 2 });
    expect(tip).toContain('2 assessments');
  });
});
