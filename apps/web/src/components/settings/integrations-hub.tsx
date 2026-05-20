'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import {
  configureIntegration,
  createPublicApiKey,
  createWebhook,
  revokePublicApiKey,
  revokeWebhook,
  saveIntegrations,
  testIntegration,
  testWebhook,
} from '@/app/settings/integrations/actions';

type MarketplaceItem = {
  code: string;
  name: string;
  category: string;
  description: string;
  enabled: boolean;
  configured: boolean;
};

type WebhookRow = {
  id: string;
  event: string;
  url: string;
  entityId: string | null;
  enabled: boolean;
  createdAt: string;
};

type ApiKeyRow = {
  id: string;
  name: string;
  entityId: string | null;
  scopes: string[];
  rateLimitPerMinute: number;
  apiKeyLookup: string;
  lastUsedAt: string | null;
  createdAt: string;
};

type DeveloperDocs = {
  openApiUi?: string;
  openApiJson?: string;
  postmanCollection?: string;
};

type Props = {
  marketplace: MarketplaceItem[];
  webhooks: WebhookRow[];
  apiKeys: ApiKeyRow[];
  developerDocs: DeveloperDocs | null;
  icalUrl: string | null;
  legacy: { zoomEnabled: boolean; whatsappEnabled: boolean; calendarProvider: string };
  entityId?: string;
  readOnly?: boolean;
};

const CATEGORY_ORDER = [
  'VIDEO_CONFERENCING',
  'COMMUNICATION',
  'CALENDAR',
  'ACADEMIC',
  'PAYMENT',
] as const;

const cardStyle: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: '1rem 1.15rem',
  background: '#fff',
};

const btnPrimary: React.CSSProperties = {
  padding: '0.55rem 1rem',
  borderRadius: 8,
  border: 'none',
  background: '#1e3a5f',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.88rem',
  cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  padding: '0.45rem 0.85rem',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  background: '#fff',
  fontSize: '0.85rem',
  cursor: 'pointer',
};

export function IntegrationsHub({
  marketplace,
  webhooks,
  apiKeys,
  developerDocs,
  icalUrl,
  legacy,
  entityId,
  readOnly,
}: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);
  const [pending, start] = useTransition();

  const [zoomEnabled, setZoomEnabled] = useState(legacy.zoomEnabled);
  const [whatsappEnabled, setWhatsappEnabled] = useState(legacy.whatsappEnabled);
  const [calendarProvider, setCalendarProvider] = useState(legacy.calendarProvider);

  const [webhookEvent, setWebhookEvent] = useState('student.enrolled');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [apiKeyName, setApiKeyName] = useState('Integration partner');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [configureCode, setConfigureCode] = useState<string | null>(null);
  const [configureJson, setConfigureJson] = useState('{\n  "enabled": true\n}');

  const grouped = useMemo(() => {
    const map = new Map<string, MarketplaceItem[]>();
    for (const item of marketplace) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      items: map.get(c) ?? [],
    }));
  }, [marketplace]);

  function flash(text: string, tone: 'ok' | 'err' = 'ok') {
    setMsg({ text, tone });
  }

  return (
    <div style={{ display: 'grid', gap: '1.75rem', maxWidth: 880 }}>
      {developerDocs ? (
        <section style={cardStyle}>
          <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.5rem' }}>Developer resources</h2>
          <p style={{ fontSize: '0.88rem', color: '#64748b', margin: '0 0 0.75rem' }}>
            REST API documentation, Postman starter collection, and webhook verification guide.
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.9rem', lineHeight: 1.7 }}>
            {developerDocs.openApiUi ? (
              <li>
                <a href={developerDocs.openApiUi} target="_blank" rel="noreferrer">
                  OpenAPI interactive docs
                </a>
              </li>
            ) : null}
            {developerDocs.openApiJson ? (
              <li>
                <a href={developerDocs.openApiJson} target="_blank" rel="noreferrer">
                  OpenAPI JSON export
                </a>
              </li>
            ) : null}
            {developerDocs.postmanCollection ? (
              <li>
                <a href={developerDocs.postmanCollection} target="_blank" rel="noreferrer">
                  Postman collection (starter)
                </a>
              </li>
            ) : null}
          </ul>
          {icalUrl ? (
            <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#475569' }}>
              <strong>iCal subscribe URL:</strong>{' '}
              <code style={{ wordBreak: 'break-all', fontSize: '0.8rem' }}>{icalUrl}</code>
            </p>
          ) : null}
        </section>
      ) : null}

      <section>
        <h2 style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>Integration marketplace</h2>
        <div style={{ display: 'grid', gap: '1rem' }}>
          {grouped.map(({ category, items }) => (
            <div key={category} style={cardStyle}>
              <h3
                style={{
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  color: '#64748b',
                  margin: '0 0 0.65rem',
                }}
              >
                {category.replace(/_/g, ' ')}
              </h3>
              <ul
                style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }}
              >
                {items.map((item) => (
                  <li
                    key={item.code}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '0.5rem 0',
                      borderTop: '1px solid #f1f5f9',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.95rem' }}>{item.name}</strong>
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: '0.72rem',
                          color: item.enabled ? '#15803d' : '#94a3b8',
                        }}
                      >
                        {item.enabled ? 'Enabled' : 'Disabled'}
                        {item.configured ? ' · Configured' : ''}
                      </span>
                      {item.description ? (
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.84rem', color: '#475569' }}>
                          {item.description}
                        </p>
                      ) : null}
                    </div>
                    {!readOnly ? (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          style={btnSecondary}
                          disabled={pending}
                          onClick={() => {
                            setConfigureCode(item.code);
                            setConfigureJson(
                              JSON.stringify({ enabled: item.enabled || true }, null, 2),
                            );
                          }}
                        >
                          Configure
                        </button>
                        <button
                          type="button"
                          style={btnSecondary}
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const r = await testIntegration(item.code, entityId);
                              if ('error' in r && r.error) flash(r.error, 'err');
                              else flash(`${item.name}: ${r.message}`);
                            })
                          }
                        >
                          Test
                        </button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {configureCode && !readOnly ? (
        <section style={cardStyle}>
          <h3 style={{ margin: '0 0 0.5rem' }}>Configure: {configureCode}</h3>
          <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>
            JSON settings (secrets are masked after save).
          </p>
          <textarea
            value={configureJson}
            onChange={(e) => setConfigureJson(e.target.value)}
            rows={8}
            style={{
              width: '100%',
              fontFamily: 'ui-monospace, monospace',
              fontSize: '0.82rem',
              padding: '0.65rem',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              style={btnPrimary}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  try {
                    const parsed = JSON.parse(configureJson) as Record<string, unknown>;
                    const enabled = parsed.enabled !== false;
                    const { enabled: _e, ...settings } = parsed;
                    const r = await configureIntegration(
                      configureCode,
                      settings,
                      enabled,
                      entityId,
                    );
                    if ('error' in r && r.error) flash(r.error, 'err');
                    else {
                      flash('Integration saved');
                      setConfigureCode(null);
                      router.refresh();
                    }
                  } catch {
                    flash('Invalid JSON', 'err');
                  }
                })
              }
            >
              Save configuration
            </button>
            <button type="button" style={btnSecondary} onClick={() => setConfigureCode(null)}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      <section style={cardStyle}>
        <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.75rem' }}>Quick toggles</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (readOnly) return;
            start(async () => {
              const result = await saveIntegrations(
                {
                  'integrations.zoom': { enabled: zoomEnabled },
                  'integrations.whatsapp': { enabled: whatsappEnabled },
                  'integrations.calendar': { provider: calendarProvider },
                },
                entityId,
              );
              if (result.error) flash(result.error, 'err');
              else {
                flash('Quick toggles saved');
                router.refresh();
              }
            });
          }}
          style={{ display: 'grid', gap: '0.85rem', maxWidth: 420 }}
        >
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={zoomEnabled}
              onChange={(e) => setZoomEnabled(e.target.checked)}
              disabled={readOnly || pending}
            />
            Zoom enabled
          </label>
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={whatsappEnabled}
              onChange={(e) => setWhatsappEnabled(e.target.checked)}
              disabled={readOnly || pending}
            />
            WhatsApp enabled
          </label>
          <label style={{ display: 'grid', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Calendar provider</span>
            <select
              value={calendarProvider}
              onChange={(e) => setCalendarProvider(e.target.value)}
              disabled={readOnly || pending}
              style={{ padding: '0.5rem 0.65rem', borderRadius: 8, border: '1px solid #cbd5e1' }}
            >
              <option value="none">None</option>
              <option value="google">Google Calendar</option>
              <option value="outlook">Outlook</option>
            </select>
          </label>
          {!readOnly ? (
            <button
              type="submit"
              disabled={pending}
              style={{ ...btnPrimary, width: 'fit-content' }}
            >
              Save toggles
            </button>
          ) : null}
        </form>
      </section>

      <section style={cardStyle}>
        <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.75rem' }}>Outbound webhooks</h2>
        {webhooks.length === 0 ? (
          <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>
            No webhooks configured.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '0.4rem 0' }}>Event</th>
                <th>URL</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {webhooks.map((w) => (
                <tr key={w.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.5rem 0', verticalAlign: 'top' }}>{w.event}</td>
                  <td style={{ wordBreak: 'break-all', color: '#475569' }}>{w.url}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {!readOnly ? (
                      <>
                        <button
                          type="button"
                          style={{ ...btnSecondary, marginRight: 6 }}
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const r = await testWebhook(w.id);
                              if ('error' in r && r.error) flash(r.error, 'err');
                              else flash(r.message ?? 'Test queued');
                            })
                          }
                        >
                          Test
                        </button>
                        <button
                          type="button"
                          style={btnSecondary}
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const r = await revokeWebhook(w.id);
                              if ('error' in r && r.error) flash(r.error, 'err');
                              else {
                                flash('Webhook revoked');
                                router.refresh();
                              }
                            })
                          }
                        >
                          Revoke
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!readOnly ? (
          <div style={{ display: 'grid', gap: '0.5rem', marginTop: '1rem', maxWidth: 520 }}>
            <select
              value={webhookEvent}
              onChange={(e) => setWebhookEvent(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid #cbd5e1' }}
            >
              <option value="student.enrolled">student.enrolled</option>
              <option value="enrollment.created">enrollment.created</option>
              <option value="student.status_changed">student.status_changed</option>
              <option value="grade.released">grade.released</option>
              <option value="payment.received">payment.received</option>
              <option value="workflow.completed">workflow.completed</option>
            </select>
            <input
              placeholder="https://your-app.com/webhooks/unicore"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid #cbd5e1' }}
            />
            <button
              type="button"
              disabled={pending || !webhookUrl.trim()}
              style={{ ...btnPrimary, width: 'fit-content' }}
              onClick={() =>
                start(async () => {
                  const r = await createWebhook(webhookEvent, webhookUrl, entityId);
                  if ('error' in r && r.error) flash(r.error, 'err');
                  else {
                    flash(
                      r.secret
                        ? `Webhook created. Signing secret (save now): ${r.secret}`
                        : 'Webhook created',
                    );
                    setWebhookUrl('');
                    router.refresh();
                  }
                })
              }
            >
              Add webhook
            </button>
          </div>
        ) : null}
      </section>

      <section style={cardStyle}>
        <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.5rem' }}>Public REST API keys</h2>
        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 0.75rem' }}>
          Use <code>Authorization: Bearer uc_live_…</code> with optional <code>X-Entity-ID</code>.
        </p>
        {apiKeys.length > 0 ? (
          <ul style={{ margin: '0 0 1rem', padding: 0, listStyle: 'none', fontSize: '0.88rem' }}>
            {apiKeys.map((k) => (
              <li
                key={k.id}
                style={{
                  padding: '0.5rem 0',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span>
                  <strong>{k.name}</strong> · {k.scopes.join(', ') || '*'} · {k.rateLimitPerMinute}
                  /min
                </span>
                {!readOnly ? (
                  <button
                    type="button"
                    style={btnSecondary}
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await revokePublicApiKey(k.id);
                        if ('error' in r && r.error) flash(r.error, 'err');
                        else {
                          flash('API key revoked');
                          router.refresh();
                        }
                      })
                    }
                  >
                    Revoke
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: '0.88rem', color: '#64748b' }}>No active API keys.</p>
        )}
        {!readOnly ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={apiKeyName}
              onChange={(e) => setApiKeyName(e.target.value)}
              placeholder="Key label"
              style={{
                padding: '0.5rem',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                minWidth: 200,
              }}
            />
            <button
              type="button"
              disabled={pending}
              style={btnPrimary}
              onClick={() =>
                start(async () => {
                  const r = await createPublicApiKey(apiKeyName);
                  if ('error' in r && r.error) flash(r.error, 'err');
                  else if (r.apiKey) {
                    setCreatedKey(r.apiKey);
                    flash('API key created — copy it now; it will not be shown again.');
                    router.refresh();
                  }
                })
              }
            >
              Create key
            </button>
          </div>
        ) : null}
        {createdKey ? (
          <code
            style={{
              display: 'block',
              marginTop: 10,
              padding: 10,
              background: '#f8fafc',
              borderRadius: 8,
              fontSize: '0.8rem',
              wordBreak: 'break-all',
            }}
          >
            {createdKey}
          </code>
        ) : null}
      </section>

      {msg ? (
        <p
          style={{
            fontSize: '0.88rem',
            color: msg.tone === 'err' ? '#b91c1c' : '#15803d',
            margin: 0,
          }}
        >
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
