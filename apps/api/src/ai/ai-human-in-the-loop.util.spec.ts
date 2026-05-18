import { BadRequestException } from '@nestjs/common';
import { assertHumanInTheLoop } from './ai-human-in-the-loop.util';

describe('ai-human-in-the-loop.util', () => {
  it('allows mutations without aiSuggested', () => {
    expect(() => assertHumanInTheLoop({}, 'grade')).not.toThrow();
  });

  it('blocks aiSuggested without humanConfirmed', () => {
    expect(() => assertHumanInTheLoop({ aiSuggested: true }, 'status')).toThrow(
      BadRequestException,
    );
  });

  it('allows aiSuggested with humanConfirmed', () => {
    expect(() =>
      assertHumanInTheLoop({ aiSuggested: true, humanConfirmed: true }, 'suspension'),
    ).not.toThrow();
  });
});
