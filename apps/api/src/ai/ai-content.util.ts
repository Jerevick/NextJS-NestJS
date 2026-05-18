export type QuizQuestion = {
  prompt: string;
  options: string[];
  answerIndex: number;
};

export function parseQuizJson(raw: string): { questions: QuizQuestion[] } {
  const text = raw.trim();
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  const slice = jsonStart >= 0 && jsonEnd >= 0 ? text.slice(jsonStart, jsonEnd + 1) : text;
  const parsed = JSON.parse(slice) as { questions?: unknown };
  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
  return {
    questions: questions
      .map((q) => {
        if (!q || typeof q !== 'object') return null;
        const row = q as Record<string, unknown>;
        const prompt = String(row.prompt ?? row.question ?? '').trim();
        const options = Array.isArray(row.options) ? row.options.map((o) => String(o)) : [];
        const answerIndex = Number(row.answerIndex ?? row.correctIndex ?? 0);
        if (!prompt || options.length < 2) return null;
        return { prompt, options, answerIndex };
      })
      .filter((q): q is QuizQuestion => q !== null),
  };
}
