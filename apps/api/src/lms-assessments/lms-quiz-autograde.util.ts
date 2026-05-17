export type McqGradeBreakdownItem = {
  questionId: string;
  type: string;
  maxPoints: number;
  earned: number;
  correct: boolean | null;
};

type QuestionRow = { id: string; type: string; content: unknown; points: number };

function readCorrectTextFromContent(content: unknown): string | null {
  if (!content || typeof content !== 'object') {
    return null;
  }
  const c = content as Record<string, unknown>;
  if (typeof c.correctAnswer === 'string' && c.correctAnswer.trim()) {
    return c.correctAnswer.trim();
  }
  const options = Array.isArray(c.options)
    ? c.options.filter((x): x is string => typeof x === 'string')
    : [];
  if (
    typeof c.correctOptionIndex === 'number' &&
    Number.isInteger(c.correctOptionIndex) &&
    c.correctOptionIndex >= 0 &&
    c.correctOptionIndex < options.length
  ) {
    return options[c.correctOptionIndex]!.trim();
  }
  return null;
}

function isMcqLike(type: string): boolean {
  return type === 'MCQ' || type === 'TRUE_FALSE';
}

/**
 * Scores auto-gradable questions (MCQ, TRUE_FALSE); other types appear in breakdown with earned 0 (manual grading).
 */
export function scoreMcqSubmission(
  questions: QuestionRow[],
  answers: Record<string, unknown>,
): {
  earned: number;
  maxMcqPoints: number;
  breakdown: McqGradeBreakdownItem[];
  allQuestionsAreMcq: boolean;
} {
  let earned = 0;
  let maxMcqPoints = 0;
  const breakdown: McqGradeBreakdownItem[] = [];
  let autoGradableCount = 0;

  for (const q of questions) {
    if (!isMcqLike(q.type)) {
      breakdown.push({
        questionId: q.id,
        type: q.type,
        maxPoints: q.points,
        earned: 0,
        correct: null,
      });
      continue;
    }
    autoGradableCount += 1;
    maxMcqPoints += q.points;
    const correctAnswer = readCorrectTextFromContent(q.content);
    const raw = answers[q.id];
    const chosen = typeof raw === 'string' ? raw.trim() : '';

    if (!correctAnswer) {
      breakdown.push({
        questionId: q.id,
        type: q.type,
        maxPoints: q.points,
        earned: 0,
        correct: null,
      });
      continue;
    }

    const correct = chosen.toLowerCase() === correctAnswer.toLowerCase();
    const itemEarned = correct ? q.points : 0;
    if (correct) {
      earned += q.points;
    }
    breakdown.push({
      questionId: q.id,
      type: q.type,
      maxPoints: q.points,
      earned: itemEarned,
      correct,
    });
  }

  return {
    earned,
    maxMcqPoints,
    breakdown,
    allQuestionsAreMcq: questions.length > 0 && autoGradableCount === questions.length,
  };
}
