'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export function StaffDirectoryScope() {
  const searchParams = useSearchParams();
  const scope = searchParams.get('scope') === 'institution' ? 'institution' : 'entity';

  const linkStyle = (active: boolean) =>
    ({
      padding: '0.35rem 0.75rem',
      borderRadius: 8,
      fontSize: '0.85rem',
      fontWeight: active ? 600 : 500,
      textDecoration: 'none',
      color: active ? '#1e3a5f' : '#64748b',
      background: active ? '#e0f2fe' : '#f1f5f9',
      border: `1px solid ${active ? '#7dd3fc' : '#e2e8f0'}`,
    }) as const;

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: '0.75rem', flexWrap: 'wrap' }}>
      <Link href="/staff" style={linkStyle(scope === 'entity')}>
        This campus
      </Link>
      <Link href="/staff?scope=institution" style={linkStyle(scope === 'institution')}>
        All campuses
      </Link>
    </div>
  );
}
