import Link from 'next/link';

import { auth } from '@/auth';
import { AcademicSettingsEditor } from '@/components/settings/academic-settings-editor';
import {
  SettingsNav,
  settingsMutedStyle,
  settingsPageStyle,
  settingsTitleStyle,
} from '@/components/settings/settings-nav';
import { apiBase, buildApiHeaders } from '@/lib/server-api';
import { hasPermission } from '@/lib/permissions';

type SettingRow = { key: string; value: unknown };

export default async function AcademicSettingsPage() {
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

  const [settingsRes, scalesRes] = await Promise.all([
    fetch(`${apiBase}/customization/settings${qs}`, {
      headers: buildApiHeaders(session),
      cache: 'no-store',
    }),
    fetch(`${apiBase}/grades/scales`, {
      headers: buildApiHeaders(session),
      cache: 'no-store',
    }),
  ]);
  const res = settingsRes;
  const payload = res.ok ? ((await res.json()) as { settings: SettingRow[] }) : null;
  const byKey = new Map(payload?.settings.map((s) => [s.key, s.value]) ?? []);

  const semesterRaw = byKey.get('academic.semesterLabels');
  const semesterLabels = Array.isArray(semesterRaw)
    ? semesterRaw.join(', ')
    : 'Semester 1, Semester 2';

  return (
    <main style={settingsPageStyle}>
      <SettingsNav active="/settings/academic" />
      <h1 style={settingsTitleStyle}>Academic settings</h1>
      <p style={settingsMutedStyle}>
        Grading scale, semester names, student numbering, and calendar offset.
      </p>
      <AcademicSettingsEditor
        initial={{
          studentNumberFormat: String(byKey.get('studentNumberFormat') ?? 'EXT/{year}/[SEQ:4]'),
          gradingSystem: String(byKey.get('grading.system') ?? 'PERCENTAGE'),
          semesterLabels,
          calendarOffsetDays: Number(byKey.get('academic.calendarOffsetDays') ?? 0),
        }}
        entityId={entityId}
        readOnly={!canEdit}
        gradingScaleCount={scalesRes.ok ? ((await scalesRes.json()) as unknown[]).length : 0}
      />
    </main>
  );
}
