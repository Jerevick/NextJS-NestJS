import { parseAdvisorResponse } from './ai-advisor.service';

describe('parseAdvisorResponse', () => {
  it('parses structured advisor JSON', () => {
    const out = parseAdvisorResponse(
      '{"gaps":[{"description":"2 credits short"}],"recommendations":[],"riskFlags":[],"narrative":"Summary"}',
    );
    expect(out.gaps).toHaveLength(1);
    expect(out.narrative).toBe('Summary');
  });
});
