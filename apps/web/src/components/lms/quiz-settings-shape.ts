export function readQuizSettingsShape(raw: Record<string, unknown>): {
  maxAttempts: number;
  timeLimitMinutes: string;
  shuffleQuestions: boolean;
  autoGradeMcq: boolean;
} {
  const maxAttempts =
    typeof raw.maxAttempts === 'number' && Number.isFinite(raw.maxAttempts)
      ? Math.min(20, Math.max(1, Math.floor(raw.maxAttempts)))
      : 1;
  const tl =
    typeof raw.timeLimitMinutes === 'number' &&
    Number.isFinite(raw.timeLimitMinutes) &&
    raw.timeLimitMinutes > 0
      ? String(Math.floor(raw.timeLimitMinutes))
      : '';
  return {
    maxAttempts,
    timeLimitMinutes: tl,
    shuffleQuestions: raw.shuffleQuestions === true,
    autoGradeMcq: raw.autoGradeMcq !== false,
  };
}
