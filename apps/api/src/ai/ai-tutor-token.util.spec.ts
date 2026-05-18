import { resolveTutorDailyTokenLimit } from './ai-tutor-token.util';

describe('resolveTutorDailyTokenLimit', () => {
  it('prefers institution override', () => {
    expect(resolveTutorDailyTokenLimit({ ai: { tutorDailyTokenLimit: 999 } }, 'STARTER')).toBe(999);
  });

  it('falls back to plan default', () => {
    expect(resolveTutorDailyTokenLimit({}, 'GROWTH')).toBe(25_000);
  });
});
