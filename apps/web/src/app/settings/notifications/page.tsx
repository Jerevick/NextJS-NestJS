import Link from 'next/link';

import { auth } from '@/auth';
import { NotificationTemplateEditor } from '@/components/settings/notification-template-editor';
import {
  SettingsNav,
  settingsMutedStyle,
  settingsPageStyle,
  settingsTitleStyle,
} from '@/components/settings/settings-nav';
import { apiBase, buildApiHeaders } from '@/lib/server-api';
import { hasPermission } from '@/lib/permissions';

export default async function NotificationSettingsPage() {
  const session = await auth();
  if (!session?.accessToken) {
    return (
      <main style={settingsPageStyle}>
        <Link href="/login">Sign in</Link>
      </main>
    );
  }

  const canEdit = hasPermission(session.user.permissions, 'institutions.write');
  const res = await fetch(`${apiBase}/notifications/admin/templates`, {
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  const templates = res.ok ? await res.json() : [];

  return (
    <main style={settingsPageStyle}>
      <SettingsNav active="/settings/notifications" />
      <h1 style={settingsTitleStyle}>Notification templates</h1>
      <p style={settingsMutedStyle}>
        Override platform defaults per event. Resolution order: entity → institution → UniCore
        default.
      </p>
      <NotificationTemplateEditor templates={templates} readOnly={!canEdit} />
    </main>
  );
}
