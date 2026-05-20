import {
  generateApiKeyPair,
  hashApiKey,
  signWebhookPayload,
  verifyApiKey,
  verifyWebhookPayload,
} from './integration-crypto.util';

describe('integration-crypto.util', () => {
  it('hashes and verifies API keys', () => {
    const { fullKey, hash } = generateApiKeyPair('uc_live_');
    expect(verifyApiKey(fullKey, hash)).toBe(true);
    expect(verifyApiKey(fullKey, hashApiKey('wrong'))).toBe(false);
  });

  it('signs webhook payloads deterministically', () => {
    const a = signWebhookPayload('secret', '{"a":1}', 123);
    const b = signWebhookPayload('secret', '{"a":1}', 123);
    expect(a).toBe(b);
  });

  it('rejects invalid webhook signatures', () => {
    const body = '{"a":1}';
    const ts = 1_700_000_000;
    const good = `t=${ts},v1=${signWebhookPayload('secret', body, ts)}`;
    expect(verifyWebhookPayload('secret', body, good, ts)).toBe(true);
    expect(verifyWebhookPayload('secret', body, 't=1,v1=deadbeef', ts)).toBe(false);
    expect(verifyWebhookPayload('secret', body, good, ts + 600)).toBe(false);
  });
});
