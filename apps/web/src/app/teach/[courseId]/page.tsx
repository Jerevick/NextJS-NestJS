import Link from 'next/link';

import type { LMSCourseModule } from '@/components/lms/course-structure';
import type { LmsAssessmentRow } from '@/components/lms/course-assessments-list';
import type { TeachGradebookApi } from './teach-gradebook-panel';
import type { TeachAnalyticsApi } from './teach-analytics-panel';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/permissions';

import { TeachWorkspaceTabs } from './teach-workspace-tabs';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default async function TeachCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const session = await auth();
  const token = session?.accessToken;
  const canWrite = hasPermission(session?.user?.permissions, 'lms.write');

  if (!token || !canWrite) {
    return (
      <main style={{ padding: '2rem' }}>
        <Link href="/teach">← Teach</Link>
        <p style={{ marginTop: '1rem', color: '#64748b' }}>
          You need lms.write and an API token to use this outline.
        </p>
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
    modules: LMSCourseModule[];
  };

  let assessments: LmsAssessmentRow[] = [];
  const assessRes = await fetch(
    `${apiBase}/lms/course-instances/${encodeURIComponent(courseId)}/assessments`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    },
  );
  if (assessRes.ok) {
    const payload = (await assessRes.json()) as { data: LmsAssessmentRow[] };
    assessments = payload.data ?? [];
  }

  let gradebookPayload: TeachGradebookApi | null = null;
  let analyticsPayload: TeachAnalyticsApi | null = null;
  try {
    const headers = { Authorization: `Bearer ${token}` };
    const [gbRes, anRes] = await Promise.all([
      fetch(`${apiBase}/lms/course-instances/${encodeURIComponent(courseId)}/teacher/gradebook`, {
        headers,
        cache: 'no-store',
      }),
      fetch(`${apiBase}/lms/course-instances/${encodeURIComponent(courseId)}/teacher/analytics`, {
        headers,
        cache: 'no-store',
      }),
    ]);
    if (gbRes.ok) {
      gradebookPayload = (await gbRes.json()) as TeachGradebookApi;
    }
    if (anRes.ok) {
      analyticsPayload = (await anRes.json()) as TeachAnalyticsApi;
    }
  } catch {
    /* optional snapshot */
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 1200 }}>
      <nav style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Link href="/teach">← Teach</Link>
        <Link href={`/courses/${courseId}`}>Student view</Link>
      </nav>
      <h1 style={{ color: '#0f1729' }}>
        {course.course.code} — {course.course.title}
      </h1>

      <TeachWorkspaceTabs
        courseInstanceId={course.id}
        semesterLine={`Section shell · ${course.semester.name} · ${course.isPublished ? 'Published' : 'Draft'}`}
        draftLine={`Left: syllabus order (drag modules · arrow lessons). Center: TipTap/text & media authoring. Gradebook/analytics hydrate from LMS teacher snapshots.`}
        modules={course.modules ?? []}
        assessments={assessments.map((a) => ({ id: a.id, title: a.title }))}
        gradebook={gradebookPayload}
        analytics={analyticsPayload}
      />
    </main>
  );
}
