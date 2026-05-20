import Link from 'next/link';

import { auth } from '@/auth';
import {
  SettingsNav,
  settingsMutedStyle,
  settingsPageStyle,
  settingsTitleStyle,
} from '@/components/settings/settings-nav';
import { hasPermission } from '@/lib/permissions';

const cards = [
  {
    href: '/settings/branding',
    title: 'Branding',
    desc: 'Logo, colours, and custom domain for emails and portals.',
  },
  {
    href: '/settings/academic',
    title: 'Academic',
    desc: 'Student number format, grading system, semester labels, calendar offset.',
  },
  {
    href: '/settings/custom-forms',
    title: 'Custom forms',
    desc: 'Build surveys, applications, and feedback forms with validation.',
  },
  {
    href: '/settings/notifications',
    title: 'Notifications',
    desc: 'Per-event email and in-app templates (entity → institution → platform).',
  },
  {
    href: '/settings/integrations',
    title: 'Integrations',
    desc: 'Zoom, WhatsApp, and calendar sync.',
  },
  {
    href: '/settings/payment',
    title: 'Payment',
    desc: 'Payment gateway selection for this scope.',
  },
] as const;

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.accessToken) {
    return (
      <main style={settingsPageStyle}>
        <Link href="/login">Sign in</Link>
      </main>
    );
  }

  const canConfigure = hasPermission(session.user.permissions, 'institutions.write');

  return (
    <main style={settingsPageStyle}>
      <SettingsNav active="/settings" />
      <h1 style={settingsTitleStyle}>Institution settings</h1>
      <p style={settingsMutedStyle}>
        Two-level customization: institution defaults with optional entity overrides. Scope:{' '}
        <strong>{session.user.entityScope}</strong>
        {!canConfigure && ' — read-only (institutions.write required to edit)'}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '1rem',
          marginTop: '1.5rem',
        }}
      >
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            style={{
              display: 'block',
              padding: '1.25rem',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              background: '#fff',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '1.05rem', color: '#1e3a5f' }}>{c.title}</h2>
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.88rem', color: '#64748b' }}>{c.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
