import { Plus_Jakarta_Sans } from 'next/font/google';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { auth } from '@/auth';
import { StudentPortalShell } from '@/components/student-portal/student-portal-shell';
import { fetchPortalJson } from '@/lib/portal-api';

const portalFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-portal',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export default async function StudentPortalLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.accessToken) {
    redirect('/login');
  }
  if (session.user.role !== 'STUDENT') {
    redirect('/dashboard');
  }
  if (!session.user.studentId) {
    return (
      <main style={{ padding: '2rem', maxWidth: 560 }}>
        <h1>Student portal</h1>
        <p style={{ color: '#64748b' }}>
          Your account is not linked to a student record. Contact your institution registrar.
        </p>
      </main>
    );
  }

  const profile = await fetchPortalJson<{
    displayName: string;
    readOnly: boolean;
  }>('/portal/student/profile', session);

  const displayName = profile.ok ? profile.data.displayName : (session.user.email ?? 'Student');
  const readOnly = profile.ok ? profile.data.readOnly : false;

  return (
    <div className={portalFont.variable}>
      <StudentPortalShell displayName={displayName} readOnly={readOnly}>
        {children}
      </StudentPortalShell>
    </div>
  );
}
