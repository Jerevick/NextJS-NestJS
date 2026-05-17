'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import type { LmsLearningRoutePrefix } from '@/components/lms/lms-learning-routes';

type OutlineLesson = { id: string; title: string; isPublished: boolean; sortOrder: number };
type OutlineModule = { id: string; title: string; sortOrder: number; lessons: OutlineLesson[] };

/** Collapsible, sticky-aligned module lists (Prompt 8.2). */
export function CourseOutlineNav({
  courseInstanceId,
  modules,
  studentMode,
  completedLessonIds,
  learningRoutePrefix = '/courses',
  highlightLessonId,
}: {
  courseInstanceId: string;
  modules: OutlineModule[];
  studentMode: boolean;
  completedLessonIds: string[];
  learningRoutePrefix?: LmsLearningRoutePrefix;
  /** Current lesson route — stronger emphasis in outline. */
  highlightLessonId?: string;
}) {
  const done = useMemo(() => new Set(completedLessonIds), [completedLessonIds]);

  const sorted = useMemo(
    () =>
      [...modules]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((m) => ({
          ...m,
          lessons: [...m.lessons].sort((a, b) => a.sortOrder - b.sortOrder),
        })),
    [modules],
  );

  return (
    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {sorted.length === 0 ? (
        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>No modules yet.</p>
      ) : (
        sorted.map((m, idx) => (
          <details
            key={m.id}
            open={idx === 0}
            style={{
              borderRadius: 8,
              border: '1px solid rgba(148,163,184,0.25)',
              padding: '0.35rem 0.5rem',
              background: 'rgba(15,23,41,0.35)',
            }}
          >
            <summary
              style={{
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#cbd5e1',
                listStyle: 'none',
              }}
            >
              {m.title}
            </summary>
            <ul style={{ listStyle: 'none', padding: '0.35rem 0 0', margin: 0 }}>
              {m.lessons.map((lesson) => {
                const studentDone = studentMode && lesson.isPublished && done.has(lesson.id);
                const glyph = studentMode
                  ? studentDone
                    ? { ch: '✓', hint: 'Completed', tone: '#4ade80' }
                    : lesson.isPublished
                      ? { ch: '○', hint: 'Not completed', tone: '#fbbf24' }
                      : { ch: '○', hint: 'Unpublished', tone: '#475569' }
                  : lesson.isPublished
                    ? { ch: '✓', hint: 'Published', tone: '#94a3b8' }
                    : { ch: '○', hint: 'Draft', tone: '#475569' };
                const active = lesson.id === highlightLessonId;
                return (
                  <li key={lesson.id} style={{ marginBottom: 2 }}>
                    <Link
                      href={`${learningRoutePrefix}/${courseInstanceId}/lessons/${lesson.id}`}
                      prefetch={false}
                      style={{
                        fontSize: '0.82rem',
                        color: lesson.isPublished ? '#e2e8f0' : '#64748b',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        ...(active
                          ? {
                              background: 'rgba(56, 189, 248, 0.14)',
                              borderRadius: 6,
                              padding: '2px 6px',
                              margin: '-2px -6px',
                              boxShadow: 'inset 0 0 0 1px rgba(56, 189, 248, 0.35)',
                            }
                          : {}),
                      }}
                    >
                      <span
                        title={glyph.hint}
                        style={{ opacity: 0.85, color: glyph.tone, flexShrink: 0 }}
                      >
                        {glyph.ch}
                      </span>
                      {lesson.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </details>
        ))
      )}
    </div>
  );
}
