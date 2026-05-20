import { Plus_Jakarta_Sans } from 'next/font/google';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { auth } from '@/auth';
import { GuardianPortalShell } from '@/components/guardian-portal/guardian-portal-shell';

const portalFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-portal',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export default async function GuardianPortalLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.accessToken) {
    redirect('/login');
  }
  if (session.user.role !== 'GUARDIAN') {
    redirect('/dashboard');
  }

  return (
    <div className={portalFont.variable}>
      <GuardianPortalShell email={session.user.email}>{children}</GuardianPortalShell>
    </div>
  );
}
