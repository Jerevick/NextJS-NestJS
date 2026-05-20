import { Plus_Jakarta_Sans } from 'next/font/google';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { auth } from '@/auth';
import { AlumniPortalShell } from '@/components/alumni-portal/alumni-portal-shell';
import { fetchDashboardJson } from '@/lib/dashboard-api';

const portalFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-portal',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export default async function AlumniPortalLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.accessToken) {
    redirect('/login');
  }
  if (session.user.role !== 'ALUMNI') {
    redirect('/dashboard');
  }

  const profile = await fetchDashboardJson<{ displayName: string }>('/dashboard/alumni', session);

  return (
    <div className={portalFont.variable}>
      <AlumniPortalShell
        displayName={profile.ok ? profile.data.displayName : (session.user.email ?? 'Alumni')}
      >
        {children}
      </AlumniPortalShell>
    </div>
  );
}
