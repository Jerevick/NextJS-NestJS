import { BadRequestException } from '@nestjs/common';
import { LmsQuestionType } from '@prisma/client';

export function assertValidLmsQuestionContent(
  type: LmsQuestionType,
  content: Record<string, unknown>,
): void {
  const prompt = content.prompt;
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new BadRequestException('Question content must include a non-empty prompt');
  }
  if (type === LmsQuestionType.MCQ) {
    const opts = content.options;
    if (!Array.isArray(opts) || opts.length < 2 || !opts.every((x) => typeof x === 'string')) {
      throw new BadRequestException('MCQ requires at least two string options');
    }
    const hasCorrectAnswer =
      typeof content.correctAnswer === 'string' && content.correctAnswer.trim().length > 0;
    const idx = content.correctOptionIndex;
    const hasCorrectIndex =
      typeof idx === 'number' && Number.isInteger(idx) && idx >= 0 && idx < opts.length;
    if (!hasCorrectAnswer && !hasCorrectIndex) {
      throw new BadRequestException(
        'MCQ requires correctAnswer (option text) or valid correctOptionIndex',
      );
    }
  }
  if (type === LmsQuestionType.TRUE_FALSE) {
    const ca = content.correctAnswer;
    if (ca !== 'True' && ca !== 'False') {
      throw new BadRequestException('TRUE_FALSE requires correctAnswer to be "True" or "False"');
    }
  }
}
