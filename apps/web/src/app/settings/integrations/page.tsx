import Link from 'next/link';

import { auth } from '@/auth';
import { IntegrationsHub } from '@/components/settings/integrations-hub';
import {
  SettingsNav,
  settingsMutedStyle,
  settingsPageStyle,
  settingsTitleStyle,
} from '@/components/settings/settings-nav';
import { apiBase, buildApiHeaders } from '@/lib/server-api';
import { hasPermission } from '@/lib/permissions';

function readObj(val: unknown): Record<string, unknown> {
  return val && typeof val === 'object' && !Array.isArray(val)
    ? (val as Record<string, unknown>)
    : {};
}

function unwrapList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) {
    return raw as T[];
  }
  if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: T[] }).data;
  }
  return [];
}

export default async function IntegrationsSettingsPage() {
  const session = await auth();
  if (!session?.accessToken) {
    return (
      <main style={settingsPageStyle}>
        <Link href="/login">Sign in</Link>
      </main>
    );
  }

  const canEdit =
    hasPermission(session.user.permissions, 'institutions.write') ||
    hasPermission(session.user.permissions, 'integrations.write');
  const canView =
    canEdit ||
    hasPermission(session.user.permissions, 'integrations.read') ||
    hasPermission(session.user.permissions, 'institutions.read');

  if (!canView) {
    return (
      <main style={settingsPageStyle}>
        <SettingsNav active="/settings/integrations" />
        <p>You do not have permission to view integrations.</p>
      </main>
    );
  }

  const entityId = session.user.entityScope === 'ENTITY' ? session.user.entityId : undefined;
  const qs = entityId ? `?entityId=${encodeURIComponent(entityId)}` : '';
  const headers = buildApiHeaders(session);

  const [settingsRes, marketplaceRes, webhooksRes, keysRes, docsRes, icalRes] = await Promise.all([
    fetch(`${apiBase}/customization/settings${qs}`, { headers, cache: 'no-store' }),
    fetch(`${apiBase}/integrations/marketplace${qs}`, { headers, cache: 'no-store' }),
    fetch(`${apiBase}/integrations/webhooks`, { headers, cache: 'no-store' }),
    fetch(`${apiBase}/integrations/public-api-keys`, { headers, cache: 'no-store' }),
    fetch(`${apiBase}/integrations/developer/docs`, { headers, cache: 'no-store' }),
    fetch(`${apiBase}/integrations/ical/subscribe-url${qs}`, { headers, cache: 'no-store' }),
  ]);

  const payload = settingsRes.ok
    ? ((await settingsRes.json()) as { settings: { key: string; value: unknown }[] })
    : null;
  const byKey = new Map(payload?.settings.map((s) => [s.key, s.value]) ?? []);
  const zoom = readObj(byKey.get('integrations.zoom'));
  const whatsapp = readObj(byKey.get('integrations.whatsapp'));
  const calendar = readObj(byKey.get('integrations.calendar'));

  const marketplace = marketplaceRes.ok ? await marketplaceRes.json() : [];
  const webhooks = webhooksRes.ok ? unwrapList(await webhooksRes.json()) : [];
  const apiKeys = keysRes.ok ? unwrapList(await keysRes.json()) : [];
  const developerDocs = docsRes.ok ? await docsRes.json() : null;
  const ical = icalRes.ok ? ((await icalRes.json()) as { url?: string }) : null;

  return (
    <main style={settingsPageStyle}>
      <SettingsNav active="/settings/integrations" />
      <h1 style={settingsTitleStyle}>Integrations & API</h1>
      <p style={settingsMutedStyle}>
        Connect third-party services, subscribe to platform webhooks, and issue REST API keys for
        partners and mobile apps.
      </p>
      <IntegrationsHub
        marketplace={marketplace}
        webhooks={webhooks}
        apiKeys={apiKeys}
        developerDocs={developerDocs}
        icalUrl={ical?.url ?? null}
        legacy={{
          zoomEnabled: zoom.enabled === true,
          whatsappEnabled: whatsapp.enabled === true,
          calendarProvider: typeof calendar.provider === 'string' ? calendar.provider : 'none',
        }}
        entityId={entityId}
        readOnly={!canEdit}
      />
    </main>
  );
}
