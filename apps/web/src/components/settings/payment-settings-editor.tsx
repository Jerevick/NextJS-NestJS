'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { savePaymentSettings } from '@/app/settings/payment/actions';

const GATEWAYS = ['noop', 'stripe', 'paystack', 'flutterwave', 'paymob'] as const;

type CredentialHints = {
  secretKey?: string;
  publicKey?: string;
};

export function PaymentSettingsEditor({
  initialGateway,
  maskedCredentials,
  entityId,
  readOnly,
  institutionOnlyCredentials,
}: {
  initialGateway: string;
  maskedCredentials?: CredentialHints;
  entityId?: string;
  readOnly?: boolean;
  institutionOnlyCredentials?: boolean;
}) {
  const router = useRouter();
  const [gateway, setGateway] = useState(initialGateway);
  const [secretKey, setSecretKey] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    start(async () => {
      setMsg(null);
      const result = await savePaymentSettings({
        gateway,
        secretKey: secretKey || undefined,
        publicKey: publicKey || undefined,
        entityId,
      });
      setMsg(result.error ?? 'Payment settings saved');
      if (!result.error) {
        setSecretKey('');
        setPublicKey('');
        router.refresh();
      }
    });
  }

  const fieldStyle = {
    padding: '0.5rem 0.65rem',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    width: '100%',
  };

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: '1rem', maxWidth: 480 }}>
      <label style={{ display: 'grid', gap: '0.35rem' }}>
        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Payment gateway</span>
        <select
          value={gateway}
          onChange={(e) => setGateway(e.target.value)}
          disabled={readOnly || pending}
          style={fieldStyle}
        >
          {GATEWAYS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>

      {gateway !== 'noop' && (
        <fieldset
          style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem', margin: 0 }}
        >
          <legend style={{ padding: '0 0.35rem', fontSize: '0.88rem', color: '#64748b' }}>
            API credentials
          </legend>
          {institutionOnlyCredentials && entityId && (
            <p style={{ fontSize: '0.82rem', color: '#b45309', margin: '0 0 0.75rem' }}>
              API keys are institution-wide only; switch to institution scope to update.
            </p>
          )}
          {maskedCredentials?.secretKey && (
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 0.5rem' }}>
              Current secret: <code>{maskedCredentials.secretKey}</code>
            </p>
          )}
          {maskedCredentials?.publicKey && (
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 0.5rem' }}>
              Current public key: <code>{maskedCredentials.publicKey}</code>
            </p>
          )}
          <label style={{ display: 'grid', gap: '0.35rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Secret / API key</span>
            <input
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              disabled={readOnly || pending || Boolean(institutionOnlyCredentials && entityId)}
              placeholder="Leave blank to keep existing"
              autoComplete="off"
              style={fieldStyle}
            />
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Public key (optional)</span>
            <input
              type="password"
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              disabled={readOnly || pending || Boolean(institutionOnlyCredentials && entityId)}
              placeholder="Leave blank to keep existing"
              autoComplete="off"
              style={fieldStyle}
            />
          </label>
        </fieldset>
      )}

      {!readOnly && (
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: '0.6rem 1rem',
            borderRadius: 8,
            border: 'none',
            background: '#1e3a5f',
            color: '#fff',
            fontWeight: 600,
            width: 'fit-content',
          }}
        >
          Save payment settings
        </button>
      )}
      {msg && (
        <p style={{ fontSize: '0.88rem', color: msg.includes('failed') ? '#b91c1c' : '#15803d' }}>
          {msg}
        </p>
      )}
    </form>
  );
}
