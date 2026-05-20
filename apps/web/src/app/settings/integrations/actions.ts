'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { apiBase, buildApiHeaders } from '@/lib/server-api';

type ApiCtx = { headers: Record<string, string> } | { error: string };

async function apiCtx(): Promise<ApiCtx> {
  const session = await auth();
  if (!session?.accessToken) return { error: 'Not signed in.' };
  return { headers: buildApiHeaders(session) };
}

export async function saveIntegrations(patch: Record<string, unknown>, entityId?: string) {
  const ctx = await apiCtx();
  if ('error' in ctx) return { error: ctx.error };

  const url = entityId
    ? `${apiBase}/customization/settings/entity/${encodeURIComponent(entityId)}`
    : `${apiBase}/customization/settings/institution`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { ...ctx.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ patch }),
    cache: 'no-store',
  });

  if (!res.ok) return { error: `Save failed (${res.status}): ${await res.text()}` };
  revalidatePath('/settings/integrations');
  return { ok: true as const };
}

export async function fetchMarketplace(entityId?: string) {
  const ctx = await apiCtx();
  if ('error' in ctx) return ctx;
  const qs = entityId ? `?entityId=${encodeURIComponent(entityId)}` : '';
  const res = await fetch(`${apiBase}/integrations/marketplace${qs}`, {
    headers: ctx.headers,
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Marketplace failed (${res.status})` };
  return { items: await res.json() };
}

export async function fetchWebhooks() {
  const ctx = await apiCtx();
  if ('error' in ctx) return ctx;
  const res = await fetch(`${apiBase}/integrations/webhooks`, {
    headers: ctx.headers,
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Webhooks failed (${res.status})` };
  return { webhooks: await res.json() };
}

export async function fetchPublicApiKeys() {
  const ctx = await apiCtx();
  if ('error' in ctx) return ctx;
  const res = await fetch(`${apiBase}/integrations/public-api-keys`, {
    headers: ctx.headers,
    cache: 'no-store',
  });
  if (!res.ok) return { error: `API keys failed (${res.status})` };
  return { keys: await res.json() };
}

export async function fetchDeveloperDocs() {
  const ctx = await apiCtx();
  if ('error' in ctx) return ctx;
  const res = await fetch(`${apiBase}/integrations/developer/docs`, {
    headers: ctx.headers,
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Docs failed (${res.status})` };
  return { docs: await res.json() };
}

export async function fetchIcalSubscribeUrl(entityId?: string) {
  const ctx = await apiCtx();
  if ('error' in ctx) return ctx;
  const qs = entityId ? `?entityId=${encodeURIComponent(entityId)}` : '';
  const res = await fetch(`${apiBase}/integrations/ical/subscribe-url${qs}`, {
    headers: ctx.headers,
    cache: 'no-store',
  });
  if (!res.ok) return { error: `iCal URL failed (${res.status})` };
  return { ical: (await res.json()) as { url: string; token: string } };
}

export async function testIntegration(code: string, entityId?: string) {
  const ctx = await apiCtx();
  if ('error' in ctx) return ctx;
  const qs = entityId ? `?entityId=${encodeURIComponent(entityId)}` : '';
  const res = await fetch(`${apiBase}/integrations/${encodeURIComponent(code)}/test${qs}`, {
    method: 'POST',
    headers: ctx.headers,
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: String((body as { message?: string }).message ?? res.status) };
  }
  return body as { success: boolean; message: string };
}

export async function configureIntegration(
  code: string,
  settings: Record<string, unknown>,
  enabled: boolean,
  entityId?: string,
) {
  const ctx = await apiCtx();
  if ('error' in ctx) return ctx;
  const res = await fetch(`${apiBase}/integrations/${encodeURIComponent(code)}/configure`, {
    method: 'POST',
    headers: { ...ctx.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings, enabled, entityId }),
    cache: 'no-store',
  });
  if (!res.ok) return { error: await res.text() };
  revalidatePath('/settings/integrations');
  return { ok: true as const };
}

export async function createWebhook(event: string, url: string, entityId?: string) {
  const ctx = await apiCtx();
  if ('error' in ctx) return ctx;
  const res = await fetch(`${apiBase}/integrations/webhooks`, {
    method: 'POST',
    headers: { ...ctx.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, url, entityId }),
    cache: 'no-store',
  });
  if (!res.ok) return { error: await res.text() };
  const data = (await res.json()) as { secret?: string };
  revalidatePath('/settings/integrations');
  return { ok: true as const, secret: data.secret };
}

export async function revokeWebhook(webhookId: string) {
  const ctx = await apiCtx();
  if ('error' in ctx) return ctx;
  const res = await fetch(
    `${apiBase}/integrations/webhooks/${encodeURIComponent(webhookId)}/revoke`,
    {
      method: 'POST',
      headers: ctx.headers,
      cache: 'no-store',
    },
  );
  if (!res.ok) return { error: await res.text() };
  revalidatePath('/settings/integrations');
  return { ok: true as const };
}

export async function testWebhook(webhookId: string) {
  const ctx = await apiCtx();
  if ('error' in ctx) return ctx;
  const res = await fetch(
    `${apiBase}/integrations/webhooks/${encodeURIComponent(webhookId)}/test`,
    { method: 'POST', headers: ctx.headers, cache: 'no-store' },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { error: String((body as { message?: string }).message ?? res.status) };
  return body as { ok: boolean; message: string };
}

export async function createPublicApiKey(name: string, scopes?: string[]) {
  const ctx = await apiCtx();
  if ('error' in ctx) return ctx;
  const res = await fetch(`${apiBase}/integrations/public-api-keys`, {
    method: 'POST',
    headers: { ...ctx.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, scopes: scopes ?? ['*'] }),
    cache: 'no-store',
  });
  if (!res.ok) return { error: await res.text() };
  const data = (await res.json()) as { apiKey?: string };
  revalidatePath('/settings/integrations');
  return { ok: true as const, apiKey: data.apiKey };
}

export async function revokePublicApiKey(keyId: string) {
  const ctx = await apiCtx();
  if ('error' in ctx) return ctx;
  const res = await fetch(
    `${apiBase}/integrations/public-api-keys/${encodeURIComponent(keyId)}/revoke`,
    { method: 'POST', headers: ctx.headers, cache: 'no-store' },
  );
  if (!res.ok) return { error: await res.text() };
  revalidatePath('/settings/integrations');
  return { ok: true as const };
}
