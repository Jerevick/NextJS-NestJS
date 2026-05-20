import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AdminHomeDashboard } from '@/components/dashboard/admin-home-dashboard';
import { FacultyHomeDashboard } from '@/components/dashboard/faculty-home-dashboard';
import { StaffHomeDashboard } from '@/components/dashboard/staff-home-dashboard';
import { StudentDashboardWrapper } from './student-dashboard-wrapper';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.accessToken) {
    redirect('/login');
  }

  const role = session.user?.role;
  const authed = session as typeof session & { accessToken: string };

  if (role === 'GUARDIAN') {
    redirect('/guardian/dashboard');
  }

  if (role === 'ALUMNI') {
    redirect('/alumni/home');
  }

  if (role === 'STUDENT' && session.user.studentId) {
    return <StudentDashboardWrapper />;
  }

  if (role === 'FACULTY') {
    return <FacultyHomeDashboard session={authed} />;
  }

  if (role === 'STAFF') {
    return <StaffHomeDashboard session={authed} />;
  }

  if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
    return <AdminHomeDashboard session={authed} />;
  }

  redirect('/login');
}
