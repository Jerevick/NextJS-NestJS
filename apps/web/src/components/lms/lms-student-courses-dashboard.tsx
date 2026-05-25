import Link from 'next/link';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/permissions';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type StudentSnapshot = {
  progressPercent: number;
  lastAccessedAt: string | null;
  dueSoonCount: number;
  dueSoonHorizonDays: number;
  continueLessonId: string | null;
  firstLessonId: string | null;
};

type CourseCard = {
  id: string;
  sectionId: string;
  isPublished: boolean;
  coverImage: string | null;
  welcomeMessage: string | null;
  course: { id: string; code: string; title: string };
  semester: { id: string; name: string };
  instructorDisplay: string | null;
  studentSnapshot?: StudentSnapshot;
};

type ListResponse = {
  data: CourseCard[];
  nextCursor?: string;
  total: number;
};

type Props = {
  /** Canonical LMS route prefix (`/lms`) or legacy (`/courses`). */
  coursesBasePath: `/lms` | `/courses`;
  /** Hide built-in sidebar when rendered inside student portal shell. */
  embedded?: boolean;
};

/** Prompt 8.2 — `/lms/page.tsx`: student LMS dashboard shell. */
export async function LmsStudentCoursesDashboard({ coursesBasePath, embedded = false }: Props) {
  const session = await auth();
  const token = session?.accessToken;
  const isStudent = Boolean(session?.user?.studentId);
  const canRead = hasPermission(session?.user?.permissions, 'lms.read');
  const canWrite = hasPermission(session?.user?.permissions, 'lms.write');

  if (!token) {
    return (
      <main style={{ padding: '2rem', maxWidth: 640, margin: '0 auto' }}>
        <nav style={{ marginBottom: '1rem' }}>
          <Link href="/dashboard" style={{ color: '#38bdf8' }}>
            ← Dashboard
          </Link>
        </nav>
        <h1 style={{ color: '#f8fafc' }}>Courses</h1>
        <p style={{ color: '#94a3b8' }}>
          Sign in with email and password (and institution slug on localhost) so your session
          includes an API access token.
        </p>
        <Link href="/login" style={{ color: '#38bdf8' }}>
          Sign in
        </Link>
      </main>
    );
  }

  if (!canRead && !isStudent) {
    return (
      <main style={{ padding: '2rem', maxWidth: 640, margin: '0 auto' }}>
        <nav style={{ marginBottom: '1rem' }}>
          <Link href="/dashboard" style={{ color: '#38bdf8' }}>
            ← Dashboard
          </Link>
        </nav>
        <h1 style={{ color: '#f8fafc' }}>Courses</h1>
        <p style={{ color: '#94a3b8' }}>
          Your account does not have the <strong>lms.read</strong> permission. Ask an administrator
          to add LMS access to your role.
        </p>
      </main>
    );
  }

  const coursesUrl = isStudent
    ? `${apiBase}/portal/student/lms/courses?limit=48&includeStudentSnapshot=true`
    : `${apiBase}/lms/course-instances?limit=48${session?.user?.studentId ? '&includeStudentSnapshot=true' : ''}`;

  const res = await fetch(coursesUrl, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text();
    return (
      <main style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
        <nav style={{ marginBottom: '1rem' }}>
          <Link href="/dashboard" style={{ color: '#38bdf8' }}>
            ← Dashboard
          </Link>
        </nav>
        <h1 style={{ color: '#f8fafc' }}>Courses</h1>
        <p style={{ color: '#f87171' }}>Could not load courses ({res.status}).</p>
        <pre style={{ fontSize: 12, overflow: 'auto', color: '#cbd5e1' }}>{body}</pre>
      </main>
    );
  }

  const payload = (await res.json()) as ListResponse;

  return (
    <div
      style={{
        display: 'flex',
        minHeight: embedded ? undefined : '100vh',
        background: embedded ? 'transparent' : '#f8fafc',
      }}
    >
      {!embedded ? (
        <aside
          style={{
            width: 220,
            flexShrink: 0,
            background: '#0f1729',
            color: '#e2e8f0',
            padding: '1.25rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '1.05rem', letterSpacing: '0.02em' }}>Learn</div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <Link
              href={coursesBasePath}
              prefetch={coursesBasePath === '/lms' ? false : undefined}
              style={{
                color: '#38bdf8',
                fontWeight: 600,
                fontSize: '0.92rem',
                textDecoration: 'none',
              }}
            >
              My courses
            </Link>
            {coursesBasePath === '/lms' ? (
              <Link
                href="/dashboard/courses"
                style={{ color: '#94a3b8', fontSize: '0.78rem', textDecoration: 'none' }}
              >
                Open legacy /courses redirect
              </Link>
            ) : (
              <Link
                href="/dashboard/lms"
                prefetch={false}
                style={{ color: '#94a3b8', fontSize: '0.78rem', textDecoration: 'none' }}
              >
                Open /lms home
              </Link>
            )}
            <Link
              href="/dashboard"
              style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem' }}
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/students"
              style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem' }}
            >
              Students
            </Link>
          </nav>
          {canWrite ? (
            <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 'auto' }}>
              Faculty: use{' '}
              <Link href="/dashboard/teach" style={{ color: '#38bdf8' }}>
                Teach
              </Link>{' '}
              for builder shortcuts (preview).
            </p>
          ) : null}
        </aside>
      ) : null}
      <main style={{ flex: 1, padding: embedded ? 0 : '2rem 1.75rem', maxWidth: 1100 }}>
        <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.75rem', color: '#0f1729' }}>My courses</h1>
        <p style={{ margin: '0 0 1.5rem', color: '#64748b', fontSize: '0.95rem' }}>
          {payload.total} course shell{payload.total === 1 ? '' : 's'}
          {session?.user?.studentId ? ' · Progress and due dates refresh per visit' : ''}
          {coursesBasePath === '/lms' && !embedded ? ' · Route: /lms' : null}
        </p>
        {payload.data.length === 0 ? (
          <p style={{ color: '#64748b' }}>
            No LMS course instances yet. With <strong>lms.write</strong>, create one via{' '}
            <code style={{ fontSize: '0.85rem' }}>POST /lms/course-instances</code> using a section
            id from Academic.
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '1rem',
            }}
          >
            {payload.data.map((c) => {
              const snap = c.studentSnapshot;
              const p = typeof snap?.progressPercent === 'number' ? snap.progressPercent : 0;
              const lessonHref =
                (snap?.continueLessonId ?? snap?.firstLessonId)
                  ? `${coursesBasePath}/${c.id}/lessons/${snap.continueLessonId ?? snap.firstLessonId}`
                  : `${coursesBasePath}/${c.id}`;
              return (
                <div
                  key={c.id}
                  style={{
                    borderRadius: 12,
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    boxShadow: '0 1px 2px rgba(15,23,41,0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 160,
                  }}
                >
                  <div
                    style={{ height: 6, background: `linear-gradient(90deg, #2563eb, #7c3aed)` }}
                  />
                  {c.coverImage && /^https?:\/\//i.test(c.coverImage.trim()) ? (
                    <div style={{ padding: '0.65rem 0.85rem 0', margin: 0, background: '#f8fafc' }}>
                      <img
                        src={c.coverImage.trim()}
                        alt=""
                        style={{ width: '100%', height: 88, objectFit: 'cover', borderRadius: 8 }}
                      />
                    </div>
                  ) : null}
                  <Link
                    href={`${coursesBasePath}/${c.id}`}
                    prefetch={coursesBasePath === '/lms' ? false : undefined}
                    style={{
                      textDecoration: 'none',
                      padding: '1rem 1.1rem',
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      color: 'inherit',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 8,
                      }}
                    >
                      <h2
                        style={{
                          margin: 0,
                          fontSize: '1.05rem',
                          color: '#0f1729',
                          fontWeight: 700,
                        }}
                      >
                        {c.course.code}
                      </h2>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '0.2rem 0.45rem',
                          borderRadius: 999,
                          background: c.isPublished ? '#dcfce7' : '#f1f5f9',
                          color: c.isPublished ? '#166534' : '#64748b',
                        }}
                      >
                        {c.isPublished ? 'Live' : 'Draft'}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: '0.35rem 0 0',
                        fontSize: '0.88rem',
                        color: '#475569',
                        lineHeight: 1.35,
                      }}
                    >
                      {c.course.title}
                    </p>
                    {c.instructorDisplay ? (
                      <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                        Instructor · {c.instructorDisplay}
                      </p>
                    ) : null}
                    {snap ? (
                      <div
                        style={{
                          marginTop: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          flexWrap: 'wrap',
                        }}
                      >
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            background: `conic-gradient(#2563eb 0deg, #2563eb ${(p / 100) * 360}deg, #e2e8f0 ${(p / 100) * 360}deg)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          aria-label={`Progress ${Math.round(p)} percent`}
                        >
                          <span
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              background: '#fff',
                              fontSize: 10,
                              fontWeight: 700,
                              color: '#0f1729',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {Math.round(p)}
                          </span>
                        </div>
                        <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                          {snap.dueSoonCount > 0 ? (
                            <span
                              style={{
                                display: 'inline-block',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                padding: '0.2rem 0.45rem',
                                borderRadius: 6,
                                background: '#fff7ed',
                                color: '#9a3412',
                                marginBottom: 4,
                              }}
                            >
                              {snap.dueSoonCount} due in {snap.dueSoonHorizonDays}d
                            </span>
                          ) : (
                            <span
                              style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}
                            >
                              No assessments due soon
                            </span>
                          )}
                          {snap.lastAccessedAt ? (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                color: '#94a3b8',
                                display: 'block',
                                marginTop: 2,
                              }}
                            >
                              Last activity ·{' '}
                              {new Date(snap.lastAccessedAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                color: '#cbd5e1',
                                display: 'block',
                                marginTop: 2,
                              }}
                            >
                              Open the course to start tracking activity
                            </span>
                          )}
                        </div>
                      </div>
                    ) : null}
                    <p style={{ margin: 'auto 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                      {c.semester.name}
                    </p>
                  </Link>
                  {session?.user?.studentId && snap ? (
                    <div
                      style={{
                        borderTop: '1px solid #f1f5f9',
                        padding: '0.55rem 1.1rem',
                        fontSize: '0.82rem',
                      }}
                    >
                      <Link
                        href={lessonHref}
                        prefetch={coursesBasePath === '/lms' ? false : undefined}
                        style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}
                      >
                        {(snap.continueLessonId
                          ? 'Continue learning'
                          : snap.firstLessonId
                            ? 'Start course'
                            : 'Open course') + ' →'}
                      </Link>
                    </div>
                  ) : null}
                  {canWrite ? (
                    <div
                      style={{
                        borderTop: '1px solid #f1f5f9',
                        padding: '0.45rem 1.1rem',
                        fontSize: '0.78rem',
                      }}
                    >
                      <Link
                        href={`/dashboard/teach/${c.id}`}
                        style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                      >
                        Teach (preview)
                      </Link>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
