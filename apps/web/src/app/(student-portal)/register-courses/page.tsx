import Link from 'next/link';
import { auth } from '@/auth';
import { PortalRegisterForm } from '@/components/student-portal/portal-register-form';
import { STUDENT_PORTAL } from '@/components/student-portal/student-portal-styles';
import { fetchPortalJson } from '@/lib/portal-api';

type CatalogPayload = {
  readOnly: boolean;
  semesters: Array<{ id: string; name: string; startDate: string }>;
  activeSemesterId: string | null;
  sections: Array<{
    id: string;
    maxEnrollment: number;
    enrolledCount: number;
    course: { code: string; title: string };
  }>;
};

export default async function RegisterCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ semesterId?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const studentId = session?.user?.studentId;
  if (!session?.accessToken || !studentId) {
    return null;
  }

  const qs = sp.semesterId ? `?semesterId=${encodeURIComponent(sp.semesterId)}` : '';
  const res = await fetchPortalJson<CatalogPayload>(
    `/portal/student/registration-catalog${qs}`,
    session,
  );

  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: 800 }}>
      <h1 style={{ margin: 0, color: STUDENT_PORTAL.text }}>Register courses</h1>
      <p style={{ color: STUDENT_PORTAL.muted }}>Select sections for the active semester.</p>

      {!res.ok ? (
        <p style={{ color: '#b91c1c' }}>Could not load catalog ({res.status}).</p>
      ) : (
        <>
          {res.data.semesters.length > 1 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: '1rem' }}>
              {res.data.semesters.map((sem) => (
                <Link
                  key={sem.id}
                  href={`/register-courses?semesterId=${encodeURIComponent(sem.id)}`}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: 8,
                    fontSize: '0.85rem',
                    textDecoration: 'none',
                    background:
                      sem.id === res.data.activeSemesterId ? STUDENT_PORTAL.teal : '#e2e8f0',
                    color: sem.id === res.data.activeSemesterId ? '#fff' : STUDENT_PORTAL.text,
                  }}
                >
                  {sem.name}
                </Link>
              ))}
            </div>
          ) : null}
          <PortalRegisterForm
            studentId={studentId}
            sections={res.data.sections}
            readOnly={res.data.readOnly}
          />
        </>
      )}
    </div>
  );
}
