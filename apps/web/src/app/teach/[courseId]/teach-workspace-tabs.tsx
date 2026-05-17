'use client';

import Link from 'next/link';
import { Box, Stack } from '@mui/material';
import { useState } from 'react';

import type { LMSCourseModule, LMSLesson } from '@/components/lms/course-structure';
import { TeachAnalyticsPanel, type TeachAnalyticsApi } from './teach-analytics-panel';
import TeachCourseOutline from './teach-course-outline';
import { TeachGradebookPanel, type TeachGradebookApi } from './teach-gradebook-panel';
import { TeachLessonWorkspace } from './teach-lesson-workspace';

/** Prompt **8.2 (4)** — faculty builder: Outline (DnD tree + lesson picker), TipTap editor strip, gradebook DataGrid, analytics charts. */

type Assess = { id: string; title: string };

type TabKey = 'outline' | 'gradebook' | 'analytics';

export function TeachWorkspaceTabs({
  courseInstanceId,
  semesterLine,
  draftLine,
  modules,
  assessments,
  gradebook,
  analytics,
}: {
  courseInstanceId: string;
  semesterLine: string;
  draftLine: string;
  modules: LMSCourseModule[];
  assessments: Assess[];
  gradebook: TeachGradebookApi | null;
  analytics: TeachAnalyticsApi | null;
}) {
  const [tab, setTab] = useState<TabKey>('outline');
  const [picked, setPicked] = useState<{ lesson: LMSLesson; moduleTitle: string } | null>(null);

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: '1.25rem' }}>
        {(
          [
            ['outline', 'Outline'],
            ['gradebook', 'Gradebook'],
            ['analytics', 'Analytics'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: 8,
              border: tab === key ? '2px solid #2563eb' : '1px solid #cbd5e1',
              background: tab === key ? '#eff6ff' : '#fff',
              fontWeight: tab === key ? 700 : 500,
              cursor: 'pointer',
              fontSize: '0.88rem',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <p
        style={{
          color: '#64748b',
          fontSize: '0.88rem',
          marginTop: '-0.5rem',
          marginBottom: '1.25rem',
        }}
      >
        {semesterLine}
      </p>
      {draftLine ? (
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.75rem' }}>{draftLine}</p>
      ) : null}

      {tab === 'outline' ? (
        <>
          <Stack
            direction={{ xs: 'column', lg: 'row' }}
            spacing={2}
            alignItems={{ xs: 'stretch', lg: 'flex-start' }}
          >
            <Box
              sx={{
                flex: { lg: '0 0 320px' },
                width: '100%',
                maxHeight: { lg: 'calc(100vh - 220px)' },
                overflowY: 'auto',
              }}
            >
              <TeachCourseOutline
                courseInstanceId={courseInstanceId}
                modules={modules}
                selectedLessonId={picked?.lesson.id ?? null}
                onSelectLesson={(lesson, _moduleId, moduleTitle) =>
                  setPicked({ lesson, moduleTitle })
                }
              />
            </Box>
            <Box sx={{ flex: '1 1 auto', minWidth: 0, width: '100%' }}>
              <TeachLessonWorkspace
                courseInstanceId={courseInstanceId}
                lesson={picked?.lesson ?? null}
                moduleTitle={picked?.moduleTitle}
                assessments={assessments}
              />
            </Box>
          </Stack>

          <section style={{ marginTop: '2.5rem' }}>
            <h2 style={{ fontSize: '1.05rem', color: '#0f1729', margin: '0 0 0.5rem' }}>
              Assessments
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '0 0 0.65rem' }}>
              Author questions on each assessment shell; quizzes preview with the LMS quiz engine
              routes.
            </p>
            {assessments.length <= 0 ? (
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
                No assessments for this shell yet.
              </p>
            ) : (
              <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
                {assessments.map((a) => (
                  <li
                    key={a.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      padding: '0.65rem 0.85rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      background: '#fff',
                    }}
                  >
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{a.title}</span>
                    <Link
                      href={`/courses/${courseInstanceId}/assessments/${a.id}`}
                      style={{ fontSize: '0.82rem', color: '#2563eb', flexShrink: 0 }}
                      prefetch={false}
                    >
                      Open authoring →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      {tab === 'gradebook' ? (
        <TeachGradebookPanel courseInstanceId={courseInstanceId} gradebook={gradebook} />
      ) : null}

      {tab === 'analytics' ? <TeachAnalyticsPanel analytics={analytics} /> : null}
    </div>
  );
}
