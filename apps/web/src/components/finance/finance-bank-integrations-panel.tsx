'use client';

import { useState, useTransition } from 'react';
import { upsertBankIntegrationAction } from '@/app/finance/actions';

type EntityOption = { id: string; name: string; code: string };

type BankIntegrationRow = {
  id: string;
  entityId: string;
  provider: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const PROVIDERS = [
  'stripe',
  'paystack',
  'flutterwave',
  'paymob',
  'bank_transfer',
  'other',
] as const;

export function FinanceBankIntegrationsPanel({
  integrations,
  entities,
  defaultEntityId,
  entityScopeAll,
  canWrite,
}: {
  integrations: BankIntegrationRow[];
  entities: EntityOption[];
  defaultEntityId?: string;
  entityScopeAll: boolean;
  canWrite: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>(PROVIDERS[0]);
  const [entityId, setEntityId] = useState(defaultEntityId ?? entities[0]?.id ?? '');
  const [isActive, setIsActive] = useState(true);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [configJson, setConfigJson] = useState('{\n  "accountNumber": "",\n  "bankCode": ""\n}');

  const entityName = (id: string) => {
    const e = entities.find((x) => x.id === id);
    return e ? `${e.name} (${e.code})` : id.slice(0, 8);
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {integrations.length > 0 ? (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '0.88rem' }}>
          {integrations.map((row) => (
            <li
              key={row.id}
              style={{
                padding: '0.6rem 0',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <span>
                <strong>{row.provider}</strong> · {entityName(row.entityId)} ·{' '}
                {row.isActive ? (
                  <span style={{ color: '#15803d' }}>Active</span>
                ) : (
                  <span style={{ color: '#94a3b8' }}>Inactive</span>
                )}
              </span>
              <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                Updated {new Date(row.updatedAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
          No bank or payout integrations configured for this scope.
        </p>
      )}

      {canWrite ? (
        <form
          style={{
            display: 'grid',
            gap: 8,
            maxWidth: 480,
            marginTop: integrations.length ? '0.5rem' : 0,
          }}
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            let config: Record<string, unknown> | undefined;
            if (configJson.trim()) {
              try {
                const parsed = JSON.parse(configJson) as unknown;
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                  config = parsed as Record<string, unknown>;
                } else {
                  setMessage('Config must be a JSON object.');
                  return;
                }
              } catch {
                setMessage('Config JSON is invalid.');
                return;
              }
            }
            startTransition(async () => {
              const r = await upsertBankIntegrationAction({
                provider,
                entityId: entityScopeAll ? entityId : undefined,
                config,
                isActive,
                webhookSecret: webhookSecret.trim() || undefined,
              });
              setMessage(r.error ?? 'Integration saved.');
            });
          }}
        >
          <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#334155' }}>
            Add or update integration
          </h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
            BURSAR-only. Stores provider credentials and payout settings per campus entity (not
            exposed in list).
          </p>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
            Provider
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
            >
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          {entityScopeAll && entities.length > 0 ? (
            <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
              Campus entity
              <select
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                required
                style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
              >
                {entities.map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {ent.name} ({ent.code})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
            Webhook secret (optional)
            <input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
              placeholder="Stripe / Paystack signing secret"
              autoComplete="off"
              style={{ padding: '0.45rem 0.6rem', borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
          </label>
          <label style={{ display: 'grid', gap: 4, fontSize: '0.85rem' }}>
            Config (JSON)
            <textarea
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              rows={5}
              style={{
                padding: '0.45rem 0.6rem',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                fontFamily: 'ui-monospace, monospace',
                fontSize: '0.8rem',
              }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>
          <button
            type="submit"
            disabled={pending || (entityScopeAll && !entityId)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 8,
              border: 'none',
              background: '#1e3a5f',
              color: '#fff',
              fontWeight: 600,
              cursor: pending ? 'wait' : 'pointer',
              width: 'fit-content',
            }}
          >
            {pending ? 'Saving…' : 'Save integration'}
          </button>
          {message ? (
            <p
              style={{
                margin: 0,
                fontSize: '0.85rem',
                color:
                  message.includes('failed') || message.includes('invalid') ? '#b91c1c' : '#15803d',
              }}
            >
              {message}
            </p>
          ) : null}
        </form>
      ) : (
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
          Finance write + BURSAR role required to manage integrations.
        </p>
      )}
    </div>
  );
}
