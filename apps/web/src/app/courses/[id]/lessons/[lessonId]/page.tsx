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
  lessons: Lesson[];
};

type CourseDetail = {
  id: string;
  course: { code: string; title: string };
  semester: { name: string };
  modules: Module[];
};

function findLesson(course: CourseDetail, lessonId: string): { module: Module; lesson: Lesson } | null {
  for (const m of course.modules) {
    const lesson = m.lessons.find((l) => l.id === lessonId);
    if (lesson) {
      return { module: m, lesson };
    }
  }
  return null;
}

export default async function LessonViewerPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id, lessonId } = await params;
  const session = await auth();
  const token = session?.accessToken;
  const canRead = hasPermission(session?.user?.permissions, 'lms.read');

  if (!token || !canRead) {
    return (
      <main style={{ padding: '2rem' }}>
        <Link href="/login">Sign in</Link>
      </main>
    );
  }

  const res = await fetch(`${apiBase}/lms/course-instances/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    notFound();
  }

  const course = (await res.json()) as CourseDetail;
  const found = findLesson(course, lessonId);
  if (!found) {
    notFound();
  }

  const { module, lesson } = found;
  const contentStr =
    typeof lesson.content === 'object' && lesson.content !== null
      ? JSON.stringify(lesson.content, null, 2)
      : String(lesson.content ?? '');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <aside
        style={{
          width: 200,
          flexShrink: 0,
          background: '#0f1729',
          padding: '1rem',
        }}
      >
        <Link href={`/courses/${id}`} style={{ color: '#38bdf8', fontSize: '0.88rem', textDecoration: 'none' }}>
          ← Course
        </Link>
        <p style={{ margin: '1rem 0 0', fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Module</p>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#cbd5e1' }}>{module.title}</p>
      </aside>
      <main style={{ flex: 1, padding: '2rem 2.5rem', maxWidth: 900 }}>
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
          {course.course.code} · {course.semester.name}
        </p>
        <h1 style={{ margin: '0.35rem 0 0', fontSize: '1.65rem', color: '#0f1729' }}>{lesson.title}</h1>
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
          Type: <strong>{lesson.type}</strong>
          {lesson.duration != null ? ` · ~${lesson.duration} min` : null}
        </p>

        {lesson.type === 'TEXT' || lesson.type === 'DOCUMENT' ? (
          <article
            style={{
              marginTop: '1.5rem',
              padding: '1.25rem 1.5rem',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              fontFamily: `var(--font-lms-reading), Georgia, serif`,
              fontSize: '1.05rem',
              lineHeight: 1.7,
              color: '#1e293b',
              whiteSpace: 'pre-wrap',
            }}
          >
            {typeof (lesson.content as { body?: unknown } | null)?.body === 'string'
              ? ((lesson.content as { body: string }).body as string)
              : contentStr}
          </article>
        ) : lesson.type === 'VIDEO' ? (
          <p style={{ marginTop: '1.5rem', color: '#64748b' }}>
            Video player (HLS) will mount here once media pipeline is connected. Raw content keys:{' '}
            <code style={{ fontSize: '0.8rem' }}>{contentStr.slice(0, 200)}</code>
            …
          </p>
        ) : (
          <pre
            style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: '#0f172a',
              color: '#e2e8f0',
              borderRadius: 8,
              fontSize: '0.82rem',
              overflow: 'auto',
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            {contentStr}
          </pre>
        )}
      </main>
    </div>
  );
}
