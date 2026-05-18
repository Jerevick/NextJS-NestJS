import { suggestWorkloadDistribution } from './staff-workload.util';

describe('suggestWorkloadDistribution', () => {
  it('distributes hours to staff with lowest utilization first', () => {
    const staff = [
      { staffId: 'a', staffNumber: 'A', totalCreditHours: 12, maxCreditHours: 18 },
      { staffId: 'b', staffNumber: 'B', totalCreditHours: 6, maxCreditHours: 18 },
    ];
    const suggestions = suggestWorkloadDistribution(staff, 6);
    expect(suggestions[0]?.staffId).toBe('b');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]?.note).toContain('h');
  });
});
