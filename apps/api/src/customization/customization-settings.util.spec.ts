import {
  assertEntityMayOverride,
  flattenPatchKeys,
  isInstitutionOnlyKey,
  resolveEffectiveSetting,
} from './customization-settings.util';

describe('institution-only settings', () => {
  it('blocks entity override keys from patch validation', () => {
    expect(() => assertEntityMayOverride('auth.mfa')).toThrow(/institution-only/i);
    expect(() => assertEntityMayOverride('billing')).toThrow(/institution-only/i);
    expect(() => assertEntityMayOverride('oauthGoogle')).toThrow(/institution-only/i);
  });

  it('allows entity-customisable keys', () => {
    expect(() => assertEntityMayOverride('studentNumberFormat')).not.toThrow();
    expect(() => assertEntityMayOverride('paymentGateway')).not.toThrow();
  });

  it('flattens nested patches for validation', () => {
    expect(flattenPatchKeys({ auth: { mfa: { enabled: true } } })).toEqual(['auth.mfa.enabled']);
    expect(isInstitutionOnlyKey('auth.mfa.enabled')).toBe(true);
  });

  it('ignores entity values for institution-only keys at read time', () => {
    const result = resolveEffectiveSetting(
      'billing',
      { billing: { plan: 'ENTERPRISE' } },
      { billing: { plan: 'HACKED' } },
    );
    expect(result.source).toBe('institution');
    expect((result.value as { plan: string }).plan).toBe('ENTERPRISE');
  });
});
