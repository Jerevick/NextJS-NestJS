import { isGuardianLinkedToStudent } from './finance-guardian-access.util';

describe('isGuardianLinkedToStudent', () => {
  it('matches userId on object entries', () => {
    expect(isGuardianLinkedToStudent([{ userId: 'guard-1', name: 'Parent' }], 'guard-1')).toBe(
      true,
    );
  });

  it('matches email when userId absent', () => {
    expect(
      isGuardianLinkedToStudent([{ email: 'parent@school.edu' }], 'other', 'parent@school.edu'),
    ).toBe(true);
  });

  it('rejects unrelated guardians', () => {
    expect(isGuardianLinkedToStudent([{ userId: 'other' }], 'guard-1')).toBe(false);
  });
});
