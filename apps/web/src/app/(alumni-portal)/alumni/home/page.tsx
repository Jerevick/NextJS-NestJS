import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { AlumniHomeDashboard } from '@/components/alumni-portal/alumni-home-dashboard';

export default async function AlumniHomePage() {
  const session = await auth();
  if (!session?.accessToken || session.user.role !== 'ALUMNI') {
    redirect('/login');
  }

  return <AlumniHomeDashboard session={session as typeof session & { accessToken: string }} />;
}
