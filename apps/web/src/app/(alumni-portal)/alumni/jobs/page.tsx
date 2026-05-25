import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { fetchPortalJson } from '@/lib/portal-api';

type AlumniJob = {
  id: string;
  title: string;
  company: string;
  description: string;
  requirements: string[];
  salary: string | null;
  location: string | null;
  type: string;
  deadline: string | null;
  createdAt: string;
};

export default async function AlumniJobsPage() {
  const session = await auth();
  if (!session?.accessToken || session.user.role !== 'ALUMNI') {
    redirect('/login');
  }

  const res = await fetchPortalJson<AlumniJob[]>('/portal/alumni/jobs', session);

  return (
    <main style={{ maxWidth: 900 }}>
      <p style={{ margin: '0 0 0.5rem' }}>
        <Link href="/dashboard/alumni/home" style={{ color: '#0d9488' }}>
          ← Home
        </Link>
      </p>
      <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Career board</h1>
      <p style={{ color: '#64748b', marginTop: '0.35rem', fontSize: '0.92rem' }}>
        Open roles posted for alumni and the wider community.
      </p>

      {!res.ok ? (
        <p style={{ color: '#b91c1c', marginTop: '1rem' }}>Could not load jobs ({res.status}).</p>
      ) : res.data.length === 0 ? (
        <p style={{ color: '#64748b', marginTop: '1rem' }}>No active job postings.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, marginTop: '1.25rem' }}>
          {res.data.map((j) => (
            <li
              key={j.id}
              style={{
                padding: '1rem',
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                marginBottom: 10,
              }}
            >
              <strong>{j.title}</strong>
              <span style={{ color: '#64748b' }}> · {j.company}</span>
              <p style={{ margin: '0.35rem 0', fontSize: '0.88rem', color: '#64748b' }}>
                {j.type.replace(/_/g, ' ')}
                {j.location ? ` · ${j.location}` : ''}
                {j.salary ? ` · ${j.salary}` : ''}
                {j.deadline ? ` · Apply by ${new Date(j.deadline).toLocaleDateString()}` : ''}
              </p>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>
                {j.description}
              </p>
              {j.requirements?.length ? (
                <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', fontSize: '0.85rem' }}>
                  {j.requirements.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
