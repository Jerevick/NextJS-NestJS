import Link from 'next/link';

import { auth } from '@/auth';
import { BrandingEditor } from '@/components/settings/branding-editor';
import {
  SettingsNav,
  settingsMutedStyle,
  settingsPageStyle,
  settingsTitleStyle,
} from '@/components/settings/settings-nav';
import { apiBase, buildApiHeaders } from '@/lib/server-api';
import { hasPermission } from '@/lib/permissions';

type BrandingPayload = {
  institutionName: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  customDomain?: string | null;
};

export default async function BrandingSettingsPage() {
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

  const res = await fetch(`${apiBase}/customization/branding${qs}`, {
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  const branding = res.ok ? ((await res.json()) as BrandingPayload) : null;

  return (
    <main style={settingsPageStyle}>
      <SettingsNav active="/settings/branding" />
      <h1 style={settingsTitleStyle}>Branding</h1>
      <p style={settingsMutedStyle}>
        Logo, primary colour, and custom domain cascade from entity → institution → platform
        defaults.
      </p>
      {branding ? (
        <BrandingEditor
          initial={{
            institutionName: branding.institutionName,
            logoUrl: typeof branding.logoUrl === 'string' ? branding.logoUrl : '',
            primaryColor:
              typeof branding.primaryColor === 'string' ? branding.primaryColor : '#1e3a5f',
            customDomain: typeof branding.customDomain === 'string' ? branding.customDomain : '',
          }}
          entityId={entityId}
          readOnly={!canEdit}
        />
      ) : (
        <p style={{ color: '#b91c1c' }}>Could not load branding settings.</p>
      )}
    </main>
  );
}
