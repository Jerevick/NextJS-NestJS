import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../../auth/auth.types';
import {
  assertEntityAccess,
  assertInstitutionAccess,
} from '../../org-structure/org-structure.utils';

function actor(partial: Partial<AuthUser> & Pick<AuthUser, 'institutionId'>): AuthUser {
  return {
    userId: 'u1',
    email: 'a@test.edu',
    role: 'STAFF',
    entityId: 'ent-a',
    entityScope: 'ENTITY',
    permissions: ['students.read'],
    ...partial,
  } as AuthUser;
}

describe('entity isolation helpers (Phase 16)', () => {
  it('blocks cross-institution access', () => {
    const a = actor({ institutionId: 'inst-1', permissions: ['students.read'] });
    expect(() => assertInstitutionAccess(a, 'inst-2')).toThrow(ForbiddenException);
  });

  it('allows platform operator across institutions', () => {
    const a = actor({ institutionId: 'inst-1', permissions: ['*'] });
    expect(() => assertInstitutionAccess(a, 'inst-2')).not.toThrow();
  });

  it('blocks entity-scoped user from another campus entity', () => {
    const a = actor({
      institutionId: 'inst-1',
      entityId: 'ent-a',
      entityScope: 'ENTITY',
    });
    expect(() => assertEntityAccess(a, 'ent-b')).toThrow(ForbiddenException);
  });

  it('allows institution-wide scope to any entity', () => {
    const a = actor({
      institutionId: 'inst-1',
      entityScope: 'ALL',
    });
    expect(() => assertEntityAccess(a, 'ent-b')).not.toThrow();
  });
});
