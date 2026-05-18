import { parseQuizJson } from './ai-content.util';

describe('parseQuizJson', () => {
  it('parses questions array', () => {
    const { questions } = parseQuizJson(
      '{"questions":[{"prompt":"Q1","options":["A","B"],"answerIndex":0}]}',
    );
    expect(questions).toHaveLength(1);
    expect(questions[0]!.prompt).toBe('Q1');
  });
});
