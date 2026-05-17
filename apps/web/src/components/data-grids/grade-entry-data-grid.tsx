'use client';

import type { GridColDef } from '@mui/x-data-grid';
import { UniCoreDataGrid } from '@unicore/ui';
import type { GradeComponentWeightBand } from '@/app/grades/entry/grade-entry-cell';
import { GradeEntryCell } from '@/app/grades/entry/grade-entry-cell';

export type { GradeComponentWeightBand };

type GradeJson = {
  score?: number;
  letterGrade?: string;
  gradePoints?: number;
  workflowStatus?: string;
  components?: Record<string, unknown>;
};

export type GradeEntryGridRow = {
  id: string;
  studentLabel: string;
  gradeDisplay: string;
  sectionId: string;
  initialGrade: GradeJson | null;
};

export function GradeEntryDataGrid({
  rows,
  sectionId,
  componentWeights = [],
}: {
  rows: GradeEntryGridRow[];
  sectionId: string;
  componentWeights?: GradeComponentWeightBand[];
}) {
  const columns: GridColDef<GradeEntryGridRow>[] = [
    { field: 'studentLabel', headerName: 'Student', flex: 1.2, minWidth: 160 },
    { field: 'gradeDisplay', headerName: 'Current grade', flex: 0.8, minWidth: 120 },
    {
      field: 'id',
      headerName: 'Entry',
      flex: 1.6,
      minWidth: 360,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) => (
        <GradeEntryCell
          enrollmentId={row.id}
          sectionId={sectionId}
          initialGrade={row.initialGrade}
          componentWeights={componentWeights}
        />
      ),
    },
  ];

  return (
    <UniCoreDataGrid rows={rows} columns={columns} getRowId={(r: GradeEntryGridRow) => r.id} />
  );
}
