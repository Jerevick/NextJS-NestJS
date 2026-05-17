import Link from 'next/link';
import type { ReactNode } from 'react';

import { CourseOutlineNav } from '@/components/lms/course-outline-nav';
import { LmsAiTutorDrawer } from '@/components/lms/lms-ai-tutor-drawer';
import { LmsCourseProgressBar } from '@/components/lms/lms-course-progress-bar';
import { lmsCourseGradient } from '@/components/lms/lms-course-accent';
import type { LmsLearningRoutePrefix } from '@/components/lms/lms-learning-routes';

export type LmsOutlineLesson = {
  id: string;
  title: string;
  type: string;
  isPublished: boolean;
  sortOrder: number;
};
export type LmsOutlineModule = {
  id: string;
  title: string;
  sortOrder: number;
  isPublished: boolean;
  unlockCondition: unknown;
  lessons: LmsOutlineLesson[];
};

export type LmsLearningShellProps = {
  courseInstanceId: string;
  learningRoutePrefix: LmsLearningRoutePrefix;
  catalogHref: string;
  modules: LmsOutlineModule[];
  completedLessonIds: string[];
  studentId: string | null;
  progressPercent?: number | null;
  /** Course header (sticky aside). */
  courseCode: string;
  courseTitle: string;
  semesterName: string;
  canWriteNotes: boolean;
  /** Highlights the active lesson in the outline. */
  currentLessonId?: string | null;
  /** Shown inside the tutor rail when drilling into a lesson. */
  tutorLessonTitle?: string | null;
  accessPingSlot?: ReactNode;
  children: ReactNode;
};

/** Shared `/lms` + `/courses` layout: navy sticky outline + main + collapsible tutor rail (Prompt **8.2 (2)**). */
export function LmsLearningShell({
  courseInstanceId: id,
  learningRoutePrefix,
  catalogHref,
  modules,
  completedLessonIds,
  studentId,
  progressPercent,
  courseCode,
  courseTitle,
  semesterName,
  canWriteNotes,
  currentLessonId = null,
  tutorLessonTitle = null,
  accessPingSlot = null,
  children,
}: LmsLearningShellProps) {
  const altCatalogHref = learningRoutePrefix === '/lms' ? '/courses' : '/lms';
  const altCatalogLabel = learningRoutePrefix === '/lms' ? 'Catalog (/courses)' : '/lms home';

  const hasPercent =
    studentId != null && typeof progressPercent === 'number' && !Number.isNaN(progressPercent);
  const accentBar = hasPercent ? (
    <LmsCourseProgressBar percent={progressPercent} />
  ) : (
    <div
      style={{
        height: 4,
        borderRadius: 2,
        background: lmsCourseGradient(id),
        marginBottom: '1.25rem',
      }}
    />
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      {accessPingSlot}
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
        <Link
          href={catalogHref}
          style={{ color: '#38bdf8', fontSize: '0.9rem', textDecoration: 'none' }}
        >
          ← All courses
        </Link>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.72rem' }}>
          <Link
            href={altCatalogHref}
            prefetch={false}
            style={{ color: '#64748b', textDecoration: 'none' }}
          >
            {altCatalogLabel}
          </Link>
        </p>
        <h1
          style={{
            fontSize: '1.1rem',
            margin: '1rem 0 0.25rem',
            color: '#f8fafc',
            lineHeight: 1.3,
          }}
        >
          {courseCode}
        </h1>
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>{semesterName}</p>
        <Link
          prefetch={false}
          href={`${learningRoutePrefix}/${id}`}
          style={{
            display: 'block',
            marginTop: '1rem',
            fontSize: '0.82rem',
            fontWeight: 600,
            color: '#bae6fd',
            textDecoration: 'none',
          }}
        >
          Course home →
        </Link>
        <div
          style={{
            marginTop: '1rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#64748b',
            textTransform: 'uppercase',
          }}
        >
          Modules
        </div>
        <CourseOutlineNav
          courseInstanceId={id}
          modules={modules}
          studentMode={Boolean(studentId)}
          completedLessonIds={completedLessonIds}
          learningRoutePrefix={learningRoutePrefix}
          highlightLessonId={currentLessonId ?? undefined}
        />
        {canWriteNotes ? (
          <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: '#475569' }}>
            Builder API: modules & lessons via <code style={{ fontSize: '0.7rem' }}>/lms/...</code>
          </p>
        ) : null}
      </aside>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          background: '#f8fafc',
        }}
      >
        <div style={{ display: 'flex', flex: 1, minHeight: 0, alignItems: 'stretch' }}>
          <main style={{ flex: 1, padding: '2rem 2.5rem', maxWidth: 900, minWidth: 0 }}>
            {accentBar}
            {children}
          </main>
          <LmsAiTutorDrawer courseTitle={courseTitle} lessonTitle={tutorLessonTitle ?? undefined} />
        </div>
      </div>
    </div>
  );
}
