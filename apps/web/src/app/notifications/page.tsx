import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { NotificationsList } from '@/components/notifications/notifications-list';
import { appendOptionalEntityHeader } from '@/lib/api-headers';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.accessToken) {
    redirect('/login');
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Institution-ID': session.user.institutionId,
  };
  appendOptionalEntityHeader(headers, session.user);

  const res = await fetch(`${apiBase}/notifications`, {
    headers,
    cache: 'no-store',
  });

  const payload = res.ok
    ? ((await res.json()) as {
        data: Array<{
          id: string;
          category: string;
          title: string;
          body: string;
          actionUrl: string | null;
          readAt: string | null;
          createdAt: string;
        }>;
        unreadCount: number;
      })
    : null;

  return (
    <main style={{ padding: '2rem 2.5rem', maxWidth: 720, minHeight: '100vh' }}>
      <Link
        href="/dashboard"
        style={{ color: '#0d9488', fontSize: '0.9rem', textDecoration: 'none' }}
      >
        ← Dashboard
      </Link>
      <h1 style={{ margin: '0.75rem 0 0', color: '#0f1729' }}>Notifications</h1>
      {payload ? (
        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{payload.unreadCount} unread</p>
      ) : (
        <p style={{ color: '#b91c1c' }}>Could not load notifications.</p>
      )}
      <NotificationsList initial={payload?.data ?? []} />
    </main>
  );
}
