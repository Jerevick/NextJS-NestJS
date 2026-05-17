import Link from 'next/link';
import { notFound } from 'next/navigation';

import { auth } from '@/auth';
import { hasPermission } from '@/lib/permissions';
import type { LMSLesson as LmsCourseLessonDetail } from '@/components/lms/course-structure';
import { LessonCompleteButton } from '@/components/lms/lesson-complete-button';
import { HlsVideoPlayer } from '@/components/lms/hls-video-player';
import { LessonResourcesList } from '@/components/lms/lesson-resources-list';
import { QuizLessonPanel, quizLessonAssessmentId } from '@/components/lms/quiz-lesson-panel';
import { CourseAccessPing } from '@/components/lms/course-access-ping';
import { LmsLearningShell, type LmsOutlineModule } from '@/components/lms/lms-learning-shell';
import { LessonPdfViewer } from '@/components/lms/lesson-pdf-viewer';

import type { LmsLearningRoutePrefix } from '@/components/lms/lms-learning-routes';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type Lesson = LmsCourseLessonDetail;

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

export type LmsLessonViewerProps = {
  courseInstanceId: string;
  lessonId: string;
  learningRoutePrefix: LmsLearningRoutePrefix;
  /** Resolved student scope (`null` staff browse). */
  studentId: string | null;
};

function findLesson(
  course: CourseDetail,
  lessonId: string,
): { module: Module; lesson: Lesson } | null {
  for (const m of course.modules) {
    const lesson = m.lessons.find((l) => l.id === lessonId);
    if (lesson) {
      return { module: m, lesson };
    }
  }
  return null;
}

function lessonRichHtmlBody(content: unknown): string | null {
  if (!content || typeof content !== 'object') {
    return null;
  }
  const o = content as Record<string, unknown>;
  const raw =
    typeof o.body === 'string' ? o.body : typeof o.html === 'string' ? (o.html as string) : '';
  const s = raw.trim();
  if (!s) {
    return null;
  }
  return /<\/?[a-z][\s\S]*>/i.test(s) ? s : null;
}

function lessonBodyText(content: unknown): string {
  if (typeof (content as { body?: unknown } | null)?.body === 'string') {
    return (content as { body: string }).body;
  }
  return '';
}

/** HTTPS PDF/embed URL when lesson JSON includes `pdfUrl`, `pdf`, `embedUrl`, etc. */
function documentHttpsEmbedUrl(content: unknown): string | null {
  if (!content || typeof content !== 'object') {
    return null;
  }
  const o = content as Record<string, unknown>;
  for (const k of ['pdfUrl', 'pdf', 'embedUrl', 'url', 'href'] as const) {
    const v = o[k];
    if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) {
      return v.trim();
    }
  }
  return null;
}

function estimateReadingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

/** Type-specific lesson body for `/courses/...` and Prompt **8.2** `/lms/...` shells. */
export async function LmsLessonViewer({
  courseInstanceId: id,
  lessonId,
  learningRoutePrefix,
  studentId,
}: LmsLessonViewerProps) {
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

  const { lesson } = found;

  const quizAssessmentId = quizLessonAssessmentId(lesson.content);

  let alreadyCompleted = false;
  let completedLessonIds: string[] = [];
  let progressPercent: number | null = null;
  if (studentId) {
    const progressRes = await fetch(
      `${apiBase}/lms/course-instances/${encodeURIComponent(id)}/progress?studentId=${encodeURIComponent(studentId)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    );
    if (progressRes.ok) {
      const progress = (await progressRes.json()) as {
        completedLessons: string[];
        progressPercent?: number;
      };
      completedLessonIds = progress.completedLessons ?? [];
      const p =
        typeof progress.progressPercent === 'number' && !Number.isNaN(progress.progressPercent)
          ? progress.progressPercent
          : null;
      progressPercent = p;
      alreadyCompleted = completedLessonIds.includes(lessonId);
    }
  }

  const canWrite = hasPermission(session?.user?.permissions, 'lms.write');
  const catalogHref = learningRoutePrefix === '/lms' ? '/lms' : '/courses';

  const contentStr =
    typeof lesson.content === 'object' && lesson.content !== null
      ? JSON.stringify(lesson.content, null, 2)
      : String(lesson.content ?? '');

  const bodyText = lessonBodyText(lesson.content);
  const richHtml = lesson.type === 'TEXT' ? lessonRichHtmlBody(lesson.content) : null;
  const readSource =
    lesson.type === 'TEXT'
      ? (richHtml ? richHtml.replace(/<[^>]*>/g, ' ') : bodyText) || contentStr
      : '';
  const readMinutes =
    lesson.type === 'TEXT'
      ? estimateReadingMinutes(readSource.replace(/\s+/g, ' ').trim() || '')
      : null;
  const embedDocUrl = lesson.type === 'DOCUMENT' ? documentHttpsEmbedUrl(lesson.content) : null;

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
      currentLessonId={lessonId}
      tutorLessonTitle={lesson.title}
      accessPingSlot={accessPing}
    >
      <nav
        aria-label="Breadcrumb"
        style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}
      >
        <Link
          prefetch={false}
          href={`${learningRoutePrefix}/${id}`}
          style={{ color: '#2563eb', textDecoration: 'none' }}
        >
          Course home
        </Link>{' '}
        <span aria-hidden>/</span> <span style={{ color: '#94a3b8' }}>Lesson</span>
      </nav>
      <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
        {course.course.code} · {course.semester.name}
      </p>
      <h1 style={{ margin: '0.35rem 0 0', fontSize: '1.65rem', color: '#0f1729' }}>
        {lesson.title}
      </h1>
      <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
        Type: <strong>{lesson.type}</strong>
        {lesson.duration != null ? ` · ~${lesson.duration} min` : null}
        {readMinutes != null ? ` · ~${readMinutes} min read` : null}
      </p>

      {lesson.type === 'TEXT' ? (
        richHtml ? (
          <article
            style={{
              marginTop: '1.5rem',
              padding: '1.25rem 1.5rem',
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              fontFamily: `'Inter', -apple-system, sans-serif`,
              fontSize: '1.05rem',
              lineHeight: 1.7,
              color: '#1e293b',
            }}
            dangerouslySetInnerHTML={{ __html: richHtml }}
          />
        ) : (
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
            {bodyText || contentStr}
          </article>
        )
      ) : lesson.type === 'DOCUMENT' && embedDocUrl ? (
        <LessonPdfViewer fileUrl={embedDocUrl} lessonTitle={lesson.title} />
      ) : lesson.type === 'DOCUMENT' ? (
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
          {bodyText || contentStr}
        </article>
      ) : lesson.type === 'VIDEO' ? (
        <HlsVideoPlayer
          content={lesson.content}
          title={lesson.title}
          courseInstanceId={id}
          lessonId={lessonId}
        />
      ) : null}
      <LessonResourcesList resources={lesson.resources ?? []} />
      {quizAssessmentId ? (
        !studentId || !token ? (
          <p style={{ marginTop: '1.25rem', fontSize: '0.85rem', color: '#94a3b8' }}>
            This lesson links an assessment (JSON <code>assessmentId</code>). Add{' '}
            <code>?studentId=</code> as a staff impersonation hint, or open the course signed in as
            that student, to attempt the quiz inline.
          </p>
        ) : (
          <QuizLessonPanel
            courseInstanceId={id}
            lessonContent={lesson.content}
            studentId={studentId}
            apiBase={apiBase}
            accessToken={token}
          />
        )
      ) : studentId && token ? (
        <LessonCompleteButton
          lessonId={lessonId}
          studentId={studentId}
          apiBase={apiBase}
          accessToken={token}
          alreadyCompleted={alreadyCompleted}
        />
      ) : (
        <p style={{ marginTop: '1.25rem', fontSize: '0.85rem', color: '#94a3b8' }}>
          Add <code>?studentId=</code> to the URL to mark this lesson complete.
        </p>
      )}
      {!quizAssessmentId &&
      lesson.type !== 'TEXT' &&
      lesson.type !== 'DOCUMENT' &&
      lesson.type !== 'VIDEO' ? (
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
      ) : null}
    </LmsLearningShell>
  );
}
