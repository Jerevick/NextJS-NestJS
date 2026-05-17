import Link from 'next/link';
import { notFound } from 'next/navigation';

import { auth } from '@/auth';
import { hasPermission } from '@/lib/permissions';
import {
  CourseAssessmentsList,
  type LmsAssessmentRow,
} from '@/components/lms/course-assessments-list';
import { CourseProgressCard } from '@/components/lms/course-progress-card';
import { QuizAssessmentSettingsForms } from '@/components/lms/quiz-assessment-settings-forms';
import { CourseAccessPing } from '@/components/lms/course-access-ping';
import { LmsLearningShell, type LmsOutlineModule } from '@/components/lms/lms-learning-shell';

import type { LmsLearningRoutePrefix } from '@/components/lms/lms-learning-routes';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

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

function nextIncompletePublishedLesson(
  course: CourseDetail,
  completed: ReadonlySet<string>,
): string | null {
  const mods = [...course.modules].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const mod of mods) {
    const lessons = [...mod.lessons].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const lesson of lessons) {
      if (!lesson.isPublished) continue;
      if (!completed.has(lesson.id)) {
        return lesson.id;
      }
    }
  }
  return null;
}

type LmsProgressPayload = {
  studentId: string;
  courseInstanceId: string;
  progressPercent: number;
  completedLessons: string[];
  completedModules: string[];
};

export type LmsCourseLearningHomeProps = {
  courseInstanceId: string;
  learningRoutePrefix: LmsLearningRoutePrefix;
  /** “Back to catalog” target (`/lms` or `/courses`). */
  catalogHref: string;
  /** Resolved student scope (staff `?studentId=` or enrolled self). */
  studentId: string | null;
};

/** Prompt **8.2 (2)** — `/lms/[courseId]` shell: collapsible sticky outline, progress bar, tutor rail, course home body. */
export async function LmsCourseLearningHome({
  courseInstanceId: id,
  learningRoutePrefix,
  catalogHref,
  studentId,
}: LmsCourseLearningHomeProps) {
  const session = await auth();
  const token = session?.accessToken;
  const canRead = hasPermission(session?.user?.permissions, 'lms.read');

  if (!token || !canRead) {
    return (
      <main style={{ padding: '2rem' }}>
        <Link href={catalogHref}>← Courses</Link>
        <p style={{ marginTop: '1rem', color: '#64748b' }}>
          Sign in with LMS access to view this course.
        </p>
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
        <Link href={catalogHref}>← Courses</Link>
        <p style={{ color: '#b91c1c' }}>Could not load course ({res.status}).</p>
        <pre style={{ fontSize: 12 }}>{body}</pre>
      </main>
    );
  }

  const course = (await res.json()) as CourseDetail;
  const canWrite = hasPermission(session?.user?.permissions, 'lms.write');
  const lessonCount = course.modules.reduce((n, m) => n + m.lessons.length, 0);

  let progress: LmsProgressPayload | null = null;
  let assessments: LmsAssessmentRow[] = [];

  const [progressRes, assessRes] = await Promise.all([
    studentId
      ? fetch(
          `${apiBase}/lms/course-instances/${encodeURIComponent(id)}/progress?studentId=${encodeURIComponent(studentId)}`,
          { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
        )
      : Promise.resolve(null),
    fetch(`${apiBase}/lms/course-instances/${encodeURIComponent(id)}/assessments`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }),
  ]);

  if (progressRes?.ok) {
    progress = (await progressRes.json()) as LmsProgressPayload;
  }
  if (assessRes.ok) {
    const payload = (await assessRes.json()) as { data: LmsAssessmentRow[] };
    assessments = payload.data;
  }

  const completedLessonIds = progress?.completedLessons ?? [];
  const resumeNextLessonId =
    studentId != null
      ? nextIncompletePublishedLesson(course, new Set(progress?.completedLessons ?? []))
      : null;

  const progressPercent =
    studentId != null &&
    progress?.progressPercent != null &&
    typeof progress.progressPercent === 'number'
      ? progress.progressPercent
      : null;

  const accessPing =
    session?.user?.studentId && studentId && session.user.studentId === studentId ? (
      <CourseAccessPing courseInstanceId={id} />
    ) : null;

  return (
    <LmsLearningShell
      courseInstanceId={id}
      learningRoutePrefix={learningRoutePrefix}
      catalogHref={catalogHref}
      modules={course.modules as unknown as LmsOutlineModule[]}
      completedLessonIds={completedLessonIds}
      studentId={studentId}
      progressPercent={progressPercent}
      courseCode={course.course.code}
      courseTitle={course.course.title}
      semesterName={course.semester.name}
      canWriteNotes={canWrite}
      tutorLessonTitle={null}
      accessPingSlot={accessPing}
    >
      <p
        style={{
          margin: 0,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#64748b',
        }}
      >
        Course home
      </p>
      <h2 style={{ margin: '0.35rem 0 0', fontSize: '1.85rem', color: '#0f1729' }}>
        {course.course.title}
      </h2>
      <p style={{ margin: '0.5rem 0 0', color: '#64748b', fontSize: '0.95rem' }}>
        Pick a lesson from the left outline.
        {studentId ? (
          <>
            {' '}
            Tracking progress for student <code style={{ fontSize: '0.8rem' }}>{studentId}</code>.
          </>
        ) : (
          <>
            {' '}
            Staff can add <code>?studentId=</code> on the URL to track a specific student.
          </>
        )}
      </p>
      {studentId && resumeNextLessonId ? (
        <p style={{ margin: '0.85rem 0 0' }}>
          <Link
            prefetch={false}
            href={`${learningRoutePrefix}/${id}/lessons/${resumeNextLessonId}`}
            style={{
              color: '#1d4ed8',
              fontWeight: 650,
              fontSize: '0.92rem',
              textDecoration: 'none',
            }}
          >
            Resume next lesson →
          </Link>
        </p>
      ) : null}
      {studentId ? <CourseProgressCard progress={progress} lessonCount={lessonCount} /> : null}
      <section style={{ marginTop: '1.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f1729' }}>Assessments</h3>
        <CourseAssessmentsList
          courseInstanceId={id}
          assessments={assessments}
          studentId={studentId ?? undefined}
        />
      </section>
      {canWrite && token ? (
        <QuizAssessmentSettingsForms
          assessments={assessments}
          apiBase={apiBase}
          accessToken={token}
        />
      ) : null}
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
        <p style={{ marginTop: '1.5rem', color: '#94a3b8', fontSize: '0.9rem' }}>
          No welcome message set for this shell.
        </p>
      )}
    </LmsLearningShell>
  );
}
