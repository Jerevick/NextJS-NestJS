import Link from 'next/link';

import { auth } from '@/auth';
import { CustomFormBuilder } from '@/components/settings/custom-form-builder';
import {
  SettingsNav,
  settingsMutedStyle,
  settingsPageStyle,
  settingsTitleStyle,
} from '@/components/settings/settings-nav';
import { apiBase, buildApiHeaders } from '@/lib/server-api';
import { hasPermission } from '@/lib/permissions';

type FormRow = { id: string; title: string; formType: string; status: string };

export default async function CustomFormsSettingsPage() {
  const session = await auth();
  if (!session?.accessToken) {
    return (
      <main style={settingsPageStyle}>
        <Link href="/login">Sign in</Link>
      </main>
    );
  }

  const canEdit = hasPermission(session.user.permissions, 'institutions.write');
  const res = await fetch(`${apiBase}/customization/forms`, {
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  const forms = res.ok ? ((await res.json()) as FormRow[]) : [];

  return (
    <main style={settingsPageStyle}>
      <SettingsNav active="/settings/custom-forms" />
      <h1 style={settingsTitleStyle}>Custom forms</h1>
      <p style={settingsMutedStyle}>
        Build application, scholarship, survey, and feedback forms. Publish to accept submissions
        with schema validation.
      </p>
      <CustomFormBuilder initialForms={forms} readOnly={!canEdit} />
    </main>
  );
}
