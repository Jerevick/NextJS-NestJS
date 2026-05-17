'use client';

import Link from 'next/link';

import { QuizAttemptShell } from '@/components/lms/quiz-attempt-shell';

export function quizLessonAssessmentId(content: unknown): string | null {
  if (!content || typeof content !== 'object') {
    return null;
  }
  const aid = (content as Record<string, unknown>).assessmentId;
  return typeof aid === 'string' && aid.trim() ? aid.trim() : null;
}

export function QuizLessonPanel({
  courseInstanceId,
  lessonContent,
  studentId,
  apiBase,
  accessToken,
}: {
  courseInstanceId: string;
  lessonContent: unknown;
  studentId: string;
  apiBase: string;
  accessToken: string;
}) {
  const assessmentId = quizLessonAssessmentId(lessonContent);
  if (!assessmentId) {
    return (
      <p style={{ marginTop: '1.25rem', fontSize: '0.85rem', color: '#b45309' }}>
        This quiz lesson does not declare an <code>assessmentId</code> in its content JSON yet.
      </p>
    );
  }

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <p style={{ margin: '0 0 0.85rem', fontSize: '0.85rem', color: '#64748b' }}>
        Prefer the full quiz layout?{' '}
        <Link
          href={`/courses/${courseInstanceId}/assessments/${assessmentId}`}
          prefetch={false}
          style={{ color: '#2563eb' }}
        >
          Open quiz page →
        </Link>
      </p>
      <QuizAttemptShell
        assessmentId={assessmentId}
        studentId={studentId}
        apiBase={apiBase}
        accessToken={accessToken}
      />
    </div>
  );
}
