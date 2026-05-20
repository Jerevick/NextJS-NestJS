import Link from 'next/link';

import { auth } from '@/auth';
import { PaymentSettingsEditor } from '@/components/settings/payment-settings-editor';
import {
  SettingsNav,
  settingsMutedStyle,
  settingsPageStyle,
  settingsTitleStyle,
} from '@/components/settings/settings-nav';
import { apiBase, buildApiHeaders } from '@/lib/server-api';
import { hasPermission } from '@/lib/permissions';

function readProviderCreds(
  raw: unknown,
  gateway: string,
): { secretKey?: string; publicKey?: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const root = raw as Record<string, unknown>;
  const provider = root[gateway];
  if (!provider || typeof provider !== 'object' || Array.isArray(provider)) return {};
  const p = provider as Record<string, unknown>;
  return {
    secretKey: typeof p.secretKey === 'string' ? p.secretKey : undefined,
    publicKey: typeof p.publicKey === 'string' ? p.publicKey : undefined,
  };
}

export default async function PaymentSettingsPage() {
  const session = await auth();
  if (!session?.accessToken) {
    return (
      <main style={settingsPageStyle}>
        <Link href="/login">Sign in</Link>
      </main>
    );
  }

  const canEdit = hasPermission(session.user.permissions, 'institutions.write');
  const entityId = session.user.entityScope === 'ENTITY' ? session.user.entityId : undefined;
  const qs = entityId ? `?entityId=${encodeURIComponent(entityId)}` : '';
  const res = await fetch(`${apiBase}/customization/settings${qs}`, {
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  const payload = res.ok
    ? ((await res.json()) as { settings: { key: string; value: unknown }[] })
    : null;
  const byKey = new Map(payload?.settings.map((s) => [s.key, s.value]) ?? []);
  const gateway = String(byKey.get('paymentGateway') ?? 'noop');
  const maskedCredentials = readProviderCreds(byKey.get('payment.credentials'), gateway);

  return (
    <main style={settingsPageStyle}>
      <SettingsNav active="/settings/payment" />
      <h1 style={settingsTitleStyle}>Payment</h1>
      <p style={settingsMutedStyle}>
        Gateway selection per scope. API keys are stored masked and only replaced when you enter a
        new value.
      </p>
      <PaymentSettingsEditor
        initialGateway={gateway}
        maskedCredentials={maskedCredentials}
        entityId={entityId}
        readOnly={!canEdit}
        institutionOnlyCredentials={session.user.entityScope === 'ENTITY'}
      />
    </main>
  );
}
