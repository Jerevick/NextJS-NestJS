'use client';

import { Alert, Typography } from '@mui/material';
import type { GridColDef } from '@mui/x-data-grid';
import { DataGrid } from '@mui/x-data-grid';
import { useCallback, useMemo, useState } from 'react';

import { gradeSubmissionFromTeachAction } from './actions';

export type TeachGradebookApi = {
  roster: Array<{ studentId: string; displayLabel: string }>;
  assessments: Array<{ id: string; title: string; totalPoints: number }>;
  cells: Array<{
    submissionId: string;
    assessmentId: string;
    studentId: string;
    percentScore: number | null;
    status: string;
  }>;
};

/** Spreadsheet-grade entry for LMS assessments (Prompt **8.2 (4)**). Requires submitted attempt row. */
export function TeachGradebookPanel({
  courseInstanceId,
  gradebook,
}: {
  courseInstanceId: string;
  gradebook: TeachGradebookApi | null;
}) {
  const [err, setErr] = useState<string | null>(null);

  const cellMap = useMemo(() => {
    const map = new Map<string, TeachGradebookApi['cells'][number]>();
    if (!gradebook) return map;
    for (const c of gradebook.cells) {
      map.set(`${c.assessmentId}:${c.studentId}`, c);
    }
    return map;
  }, [gradebook]);

  const { rows, columns } = useMemo(() => {
    if (!gradebook) {
      return { rows: [], columns: [] as GridColDef[] };
    }
    const defs: GridColDef[] = [
      {
        field: 'student',
        headerName: 'Student',
        flex: 1.25,
        minWidth: 200,
        editable: false,
      },
      ...gradebook.assessments.map((a) => ({
        field: `score_${a.id}`,
        headerName: a.title.length > 40 ? `${a.title.slice(0, 38)}…` : a.title,
        description: `${a.totalPoints ?? 100} pts · ${a.id.slice(0, 8)}…`,
        width: 130,
        editable: true,
        type: 'number' as const,
      })),
    ];

    const data = gradebook.roster.map((r) => {
      const row: Record<string, string | number | undefined> = {
        id: r.studentId,
        student: r.displayLabel,
      };
      for (const a of gradebook.assessments) {
        const hit = cellMap.get(`${a.id}:${r.studentId}`);
        row[`score_${a.id}`] =
          hit?.percentScore !== null && hit?.percentScore !== undefined
            ? Number(hit.percentScore)
            : undefined;
        row[`sub_${a.id}`] = hit?.submissionId ?? '';
      }
      return row;
    });

    return { rows: data, columns: defs };
  }, [gradebook, cellMap]);

  const handleRowUpdate = useCallback(
    async (newRow: (typeof rows)[number], oldRow: (typeof rows)[number]) => {
      setErr(null);
      if (!gradebook) {
        return newRow;
      }
      let changedAssessmentId: string | null = null;
      for (const a of gradebook.assessments) {
        const fld = `score_${a.id}` as const;
        if (newRow[fld] !== oldRow[fld]) {
          changedAssessmentId = a.id;
          break;
        }
      }
      if (!changedAssessmentId) {
        return newRow;
      }
      const submissionIdRaw = String(newRow[`sub_${changedAssessmentId}`] ?? '').trim();
      if (!submissionIdRaw) {
        setErr('No submission yet for this learner on that assessment.');
        throw new Error('Missing submission row');
      }
      const raw = newRow[`score_${changedAssessmentId}`];
      const numeric = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(numeric)) {
        setErr('Grade must be numeric (percentage).');
        throw new Error('Invalid number');
      }
      const result = await gradeSubmissionFromTeachAction(
        courseInstanceId,
        submissionIdRaw,
        numeric,
      );
      if (!result.ok) {
        setErr(result.message ?? 'Grade PATCH failed.');
        throw new Error(result.message ?? 'grade failed');
      }
      newRow[`score_${changedAssessmentId}`] = Math.min(100, Math.max(0, numeric));
      return newRow;
    },
    [courseInstanceId, gradebook],
  );

  if (!gradebook) {
    return (
      <Typography variant="body2" color="text.secondary">
        Gradebook unavailable for this shell (reload or confirm `lms.write` + enrolments roster).
      </Typography>
    );
  }

  if (gradebook.roster.length <= 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No active roster rows for this course section — enrol students to populate the grid.
      </Typography>
    );
  }

  if (gradebook.assessments.length <= 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No assessments yet — create quizzes or assignments from LMS authoring routes.
      </Typography>
    );
  }

  return (
    <>
      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ maxWidth: 720 }}>
        Editable cells PATCH <code>LmsSubmission.grade.percentScore</code> when at least one attempt
        exists beyond DRAFT. Draft-only attempts remain read-only until the learner submits.
      </Typography>
      {err ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {err}
        </Alert>
      ) : null}
      <div style={{ width: '100%', height: Math.min(Math.max(rows.length * 52 + 120, 360), 640) }}>
        <DataGrid
          rows={rows}
          columns={columns}
          processRowUpdate={handleRowUpdate}
          onProcessRowUpdateError={(e: unknown) =>
            setErr(e instanceof Error ? e.message : 'Could not persist grade.')
          }
          density="compact"
          disableRowSelectionOnClick
        />
      </div>
    </>
  );
}
