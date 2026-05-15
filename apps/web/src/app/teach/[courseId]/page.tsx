import Link from 'next/link';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/permissions';

const apiBase = process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default async function TeachCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await auth();
  const token = session?.accessToken;
  const canWrite = hasPermission(session?.user?.permissions, 'lms.write');

  if (!token || !canWrite) {
    return (
      <main style={{ padding: '2rem' }}>
        <Link href="/teach">← Teach</Link>
        <p style={{ marginTop: '1rem', color: '#64748b' }}>You need lms.write and an API token to use this preview.</p>
      </main>
    );
  }

  const res = await fetch(`${apiBase}/lms/course-instances/${encodeURIComponent(courseId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    return (
      <main style={{ padding: '2rem' }}>
        <Link href="/teach">← Teach</Link>
        <p style={{ color: '#b91c1c' }}>Could not load course instance ({res.status}).</p>
      </main>
    );
  }

  const course = (await res.json()) as {
    id: string;
    sectionId: string;
    isPublished: boolean;
    course: { code: string; title: string };
    semester: { name: string };
    modules: { id: string; title: string; lessons: { id: string; title: string }[] }[];
  };

  return (
    <main style={{ padding: '2rem', maxWidth: 800, fontFamily: 'system-ui' }}>
      <nav style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
        <Link href="/teach">← Teach</Link>
        <Link href={`/courses/${courseId}`}>Student view</Link>
      </nav>
      <h1 style={{ color: '#0f1729' }}>
        {course.course.code} — {course.course.title}
      </h1>
      <p style={{ color: '#64748b' }}>
        Section shell · {course.semester.name} · {course.isPublished ? 'Published' : 'Draft'}
      </p>
      <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
        Drag-and-drop builder, uploads, and assessments will live here. For now, mutate content via{' '}
        <code>/lms/course-instances/.../modules</code> and <code>/lms/modules/.../lessons</code>.
      </p>
      <h2 style={{ fontSize: '1rem', marginTop: '1.5rem' }}>Outline</h2>
      <ul>
        {course.modules.map((m) => (
          <li key={m.id} style={{ marginBottom: '0.75rem' }}>
            <strong>{m.title}</strong>
            <ul>
              {m.lessons.map((l) => (
                <li key={l.id}>
                  {l.title} ({l.id.slice(0, 8)}…)
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </main>
  );
}
