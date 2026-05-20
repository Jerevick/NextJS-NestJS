import {
  legacyCustomizationPatchForIntegration,
  maskIntegrationSettings,
} from './integration-settings.util';

describe('integration-settings.util', () => {
  it('masks secret fields', () => {
    expect(
      maskIntegrationSettings({
        clientId: 'abc',
        clientSecret: 'top-secret',
        nested: { apiKey: 'k' },
      }),
    ).toEqual({
      clientId: 'abc',
      clientSecret: '••••••••',
      nested: { apiKey: '••••••••' },
    });
  });

  it('maps zoom to customization patch', () => {
    expect(legacyCustomizationPatchForIntegration('zoom', true, { accountId: '1' })).toEqual({
      'integrations.zoom': { enabled: true, accountId: '1' },
    });
  });
});
