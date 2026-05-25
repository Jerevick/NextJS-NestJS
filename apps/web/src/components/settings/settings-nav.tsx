import Link from 'next/link';

const primary = '#1e3a5f';
const muted = '#64748b';

const links = [
  { href: '/dashboard/settings', legacyHref: '/settings', label: 'Overview' },
  { href: '/dashboard/settings/branding', legacyHref: '/settings/branding', label: 'Branding' },
  { href: '/dashboard/settings/academic', legacyHref: '/settings/academic', label: 'Academic' },
  {
    href: '/dashboard/settings/custom-forms',
    legacyHref: '/settings/custom-forms',
    label: 'Custom forms',
  },
  {
    href: '/dashboard/settings/notifications',
    legacyHref: '/settings/notifications',
    label: 'Notifications',
  },
  {
    href: '/dashboard/settings/integrations',
    legacyHref: '/settings/integrations',
    label: 'Integrations',
  },
  { href: '/dashboard/settings/payment', legacyHref: '/settings/payment', label: 'Payment' },
  {
    href: '/dashboard/settings/grading-weights',
    legacyHref: '/settings/grading-weights',
    label: 'Grading weights',
  },
  {
    href: '/dashboard/settings/org-structure',
    legacyHref: '/settings/org-structure',
    label: 'Org structure',
  },
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
      {links.map((l) => {
        const isActive = active === l.href || active === l.legacyHref;
        return (
          <Link
            key={l.href}
            href={l.href}
            style={{
              color: isActive ? primary : muted,
              fontWeight: isActive ? 600 : 400,
            }}
          >
            {l.label}
          </Link>
        );
      })}
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
