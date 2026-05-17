export type LmsQuizSettings = {
  maxAttempts: number;
  timeLimitMinutes: number | null;
  shuffleQuestions: boolean;
  /** When true (default), MCQ items are scored on submit for QUIZ/EXAM. */
  autoGradeMcq: boolean;
};

export function readLmsQuizSettings(settings: unknown): LmsQuizSettings {
  const s = (settings ?? {}) as Record<string, unknown>;
  const maxAttempts =
    typeof s.maxAttempts === 'number' && Number.isFinite(s.maxAttempts) && s.maxAttempts > 0
      ? Math.min(20, Math.floor(s.maxAttempts))
      : 1;
  const timeLimitMinutes =
    typeof s.timeLimitMinutes === 'number' &&
    Number.isFinite(s.timeLimitMinutes) &&
    s.timeLimitMinutes > 0
      ? Math.min(24 * 60, Math.floor(s.timeLimitMinutes))
      : null;
  return {
    maxAttempts,
    timeLimitMinutes,
    shuffleQuestions: s.shuffleQuestions === true,
    autoGradeMcq: s.autoGradeMcq !== false,
  };
}
