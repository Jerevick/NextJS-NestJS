import { scoreMcqSubmission } from './lms-quiz-autograde.util';

describe('scoreMcqSubmission', () => {
  it('awards full points when correctAnswer string matches', () => {
    const r = scoreMcqSubmission(
      [
        {
          id: 'q1',
          type: 'MCQ',
          points: 10,
          content: { prompt: 'x', options: ['a', 'b'], correctAnswer: 'b' },
        },
      ],
      { q1: 'b' },
    );
    expect(r.earned).toBe(10);
    expect(r.maxMcqPoints).toBe(10);
    expect(r.allQuestionsAreMcq).toBe(true);
    expect(r.breakdown[0]?.correct).toBe(true);
    expect(r.breakdown[0]?.earned).toBe(10);
  });

  it('uses correctOptionIndex when set', () => {
    const r = scoreMcqSubmission(
      [
        {
          id: 'q1',
          type: 'MCQ',
          points: 5,
          content: { options: ['x', 'y'], correctOptionIndex: 0 },
        },
      ],
      { q1: 'x' },
    );
    expect(r.earned).toBe(5);
    expect(r.breakdown[0]?.correct).toBe(true);
  });

  it('gives zero when wrong or missing key', () => {
    const r = scoreMcqSubmission(
      [
        {
          id: 'q1',
          type: 'MCQ',
          points: 10,
          content: { options: ['a', 'b'], correctAnswer: 'a' },
        },
      ],
      { q1: 'b' },
    );
    expect(r.earned).toBe(0);
    expect(r.breakdown[0]?.correct).toBe(false);
  });

  it('marks non-MCQ with null correct and zero earned', () => {
    const r = scoreMcqSubmission(
      [
        { id: 'q1', type: 'SHORT_ANSWER', points: 5, content: { prompt: 'y' } },
        {
          id: 'q2',
          type: 'MCQ',
          points: 3,
          content: { options: ['yes'], correctAnswer: 'yes' },
        },
      ],
      { q2: 'yes' },
    );
    expect(r.earned).toBe(3);
    expect(r.allQuestionsAreMcq).toBe(false);
    expect(r.breakdown[0]?.correct).toBeNull();
  });
});
