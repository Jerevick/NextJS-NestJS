import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/permissions';

const apiBase = process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type Lesson = {
  id: string;
  title: string;
  type: string;
  content: unknown;
  duration: number | null;
  sortOrder: number;
  isPublished: boolean;
};

type Module = {
  id: string;
  title: string;
  sortOrder: number;
  isPublished: boolean;
  unlockCondition: unknown;
  lessons: Lesson[];
};

type CourseDetail = {
  id: string;
  sectionId: string;
  isPublished: boolean;
  coverImage: string | null;
  welcomeMessage: string | null;
  settings: unknown;
  course: { id: string; code: string; title: string };
  semester: { id: string; name: string };
  modules: Module[];
};

export default async function CourseHomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const token = session?.accessToken;
  const canRead = hasPermission(session?.user?.permissions, 'lms.read');

  if (!token || !canRead) {
    return (
      <main style={{ padding: '2rem' }}>
        <Link href="/courses">← Courses</Link>
        <p style={{ marginTop: '1rem', color: '#64748b' }}>Sign in with LMS access to view this course.</p>
      </main>
    );
  }

  const res = await fetch(`${apiBase}/lms/course-instances/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (res.status === 404) {
    notFound();
  }

  if (!res.ok) {
    const body = await res.text();
    return (
      <main style={{ padding: '2rem' }}>
        <Link href="/courses">← Courses</Link>
        <p style={{ color: '#b91c1c' }}>Could not load course ({res.status}).</p>
        <pre style={{ fontSize: 12 }}>{body}</pre>
      </main>
    );
  }

  const course = (await res.json()) as CourseDetail;
  const canWrite = hasPermission(session?.user?.permissions, 'lms.write');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <aside
        style={{
          width: 280,
          flexShrink: 0,
          background: '#0f1729',
          color: '#e2e8f0',
          padding: '1.25rem 1rem',
          position: 'sticky',
          top: 0,
          alignSelf: 'flex-start',
          maxHeight: '100vh',
          overflowY: 'auto',
        }}
      >
        <Link href="/courses" style={{ color: '#38bdf8', fontSize: '0.9rem', textDecoration: 'none' }}>
          ← All courses
        </Link>
        <h1 style={{ fontSize: '1.1rem', margin: '1rem 0 0.25rem', color: '#f8fafc', lineHeight: 1.3 }}>
          {course.course.code}
        </h1>
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>{course.semester.name}</p>
        <div style={{ marginTop: '1.25rem', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
          Modules
        </div>
        <nav style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {course.modules.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>No modules yet.</p>
          ) : (
            course.modules.map((m) => (
              <div key={m.id}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1', marginBottom: 4 }}>{m.title}</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {m.lessons.map((lesson) => (
                    <li key={lesson.id} style={{ marginBottom: 2 }}>
                      <Link
                        href={`/courses/${id}/lessons/${lesson.id}`}
                        style={{
                          fontSize: '0.82rem',
                          color: lesson.isPublished ? '#e2e8f0' : '#64748b',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span style={{ opacity: 0.7 }}>{lesson.isPublished ? '✓' : '○'}</span>
                        {lesson.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </nav>
        {canWrite ? (
          <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#475569' }}>
            Builder API: modules & lessons via <code style={{ fontSize: '0.7rem' }}>/lms/...</code>
          </p>
        ) : null}
      </aside>
      <main style={{ flex: 1, padding: '2rem 2.5rem', maxWidth: 800 }}>
        <div
          style={{
            height: 4,
            borderRadius: 2,
            background: 'linear-gradient(90deg, #2563eb, #7c3aed)',
            marginBottom: '1.25rem',
          }}
        />
        <p style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>
          Course home
        </p>
        <h2 style={{ margin: '0.35rem 0 0', fontSize: '1.85rem', color: '#0f1729' }}>{course.course.title}</h2>
        <p style={{ margin: '0.5rem 0 0', color: '#64748b', fontSize: '0.95rem' }}>
          Pick a lesson from the left outline. Progress rings and the AI tutor panel come in a later iteration.
        </p>
        {course.welcomeMessage ? (
          <section
            style={{
              marginTop: '1.75rem',
              padding: '1.25rem 1.35rem',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              fontFamily: `var(--font-lms-reading), Georgia, serif`,
              fontSize: '1.05rem',
              lineHeight: 1.65,
              color: '#1e293b',
            }}
          >
            {course.welcomeMessage}
          </section>
        ) : (
          <p style={{ marginTop: '1.5rem', color: '#94a3b8', fontSize: '0.9rem' }}>No welcome message set for this shell.</p>
        )}
      </main>
    </div>
  );
}
