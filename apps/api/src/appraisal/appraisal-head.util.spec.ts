import { immediateHeadPositionCodes, resolveRoleExpectationsFromHr } from './appraisal-head.util';

describe('appraisal-head.util', () => {
  it('resolves role expectations by position code', () => {
    const hr = {
      roleExpectationsByPositionCode: {
        PC: {
          duties: ['Coordinate programme'],
          responsibilities: ['Line-manage staff'],
        },
      },
    };
    const result = resolveRoleExpectationsFromHr(hr, 'PC', 5);
    expect(result.duties).toEqual(['Coordinate programme']);
    expect(result.responsibilities).toEqual(['Line-manage staff']);
  });

  it('uses custom immediate head position codes when configured', () => {
    const hr = { immediateHeadPositionCodes: ['SUPERVISOR', 'PC'] };
    expect(immediateHeadPositionCodes(hr)).toEqual(['SUPERVISOR', 'PC']);
  });
});
