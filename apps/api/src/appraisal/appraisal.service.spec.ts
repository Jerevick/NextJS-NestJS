describe('AppraisalService KPI resolution', () => {
  const resolve = (hr: Record<string, unknown>, code: string, level: number) => {
    const byPosition = (hr.kpiByPositionCode as Record<string, unknown>) ?? {};
    const byLevel = (hr.kpiByPositionLevel as Record<string, unknown>) ?? {};
    return (
      (byPosition[code] as Array<{ key: string }>) ??
      (byLevel[String(level)] as Array<{ key: string }>) ??
      (hr.defaultKpi as Array<{ key: string }>) ?? [{ key: 'teaching' }]
    );
  };

  it('prefers position code over level', () => {
    const hr = {
      kpiByPositionCode: { LEC: [{ key: 'code-kpi' }] },
      kpiByPositionLevel: { '3': [{ key: 'level-kpi' }] },
    };
    expect(resolve(hr, 'LEC', 3)[0].key).toBe('code-kpi');
  });

  it('falls back to position level', () => {
    const hr = { kpiByPositionLevel: { '2': [{ key: 'level-kpi' }] } };
    expect(resolve(hr, 'LEC', 2)[0].key).toBe('level-kpi');
  });
});
