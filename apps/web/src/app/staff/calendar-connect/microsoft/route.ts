import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { apiBase, buildApiHeaders } from '@/lib/server-api';

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    redirect('/login');
  }
  const res = await fetch(`${apiBase}/staff/calendar-connect/microsoft/url`, {
    headers: buildApiHeaders(session),
    cache: 'no-store',
  });
  if (!res.ok) {
    redirect('/dashboard/staff?calendar=error');
  }
  const body = (await res.json()) as { url?: string };
  if (!body.url) {
    redirect('/dashboard/staff?calendar=error');
  }
  redirect(body.url);
}
