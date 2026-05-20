import Link from 'next/link';

const primary = '#1e3a5f';
const muted = '#64748b';

const links = [
  { href: '/settings', label: 'Overview' },
  { href: '/settings/branding', label: 'Branding' },
  { href: '/settings/academic', label: 'Academic' },
  { href: '/settings/custom-forms', label: 'Custom forms' },
  { href: '/settings/notifications', label: 'Notifications' },
  { href: '/settings/integrations', label: 'Integrations' },
  { href: '/settings/payment', label: 'Payment' },
  { href: '/settings/grading-weights', label: 'Grading weights' },
  { href: '/settings/org-structure', label: 'Org structure' },
] as const;

export function SettingsNav({ active }: { active?: string }) {
  return (
    <nav
      style={{
        display: 'flex',
        gap: '0.75rem',
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
        fontSize: '0.88rem',
      }}
    >
      <Link href="/dashboard" style={{ color: muted }}>
        Dashboard
      </Link>
      <span style={{ color: '#cbd5e1' }}>|</span>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          style={{
            color: active === l.href ? primary : muted,
            fontWeight: active === l.href ? 600 : 400,
          }}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export const settingsPageStyle = {
  padding: '2rem 1.5rem',
  maxWidth: 920,
  fontFamily: '"IBM Plex Sans", system-ui',
  margin: '0 auto',
} as const;

export const settingsTitleStyle = {
  marginTop: 0,
  color: primary,
  fontFamily: '"Crimson Pro", Georgia, serif',
} as const;

export const settingsMutedStyle = { color: muted, fontSize: '0.92rem' } as const;
