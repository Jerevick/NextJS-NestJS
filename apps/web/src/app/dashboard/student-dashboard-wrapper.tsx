import { Plus_Jakarta_Sans } from 'next/font/google';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { StudentHomeDashboard } from '@/components/student-portal/student-home-dashboard';
import { StudentPortalShell } from '@/components/student-portal/student-portal-shell';
import { fetchPortalJson } from '@/lib/portal-api';

const portalFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-portal',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

/** Student role home at /dashboard (outside route group layout). */
export async function StudentDashboardWrapper() {
  const session = await auth();
  if (!session?.accessToken || session.user.role !== 'STUDENT' || !session.user.studentId) {
    redirect('/login');
  }

  const profile = await fetchPortalJson<{ displayName: string; readOnly: boolean }>(
    '/portal/student/profile',
    session,
  );

  return (
    <div className={portalFont.variable}>
      <StudentPortalShell
        displayName={profile.ok ? profile.data.displayName : (session.user.email ?? 'Student')}
        readOnly={profile.ok ? profile.data.readOnly : false}
      >
        <StudentHomeDashboard session={session as typeof session & { accessToken: string }} />
      </StudentPortalShell>
    </div>
  );
}
