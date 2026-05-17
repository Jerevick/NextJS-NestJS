'use client';

import Link from 'next/link';
import type { GridColDef } from '@mui/x-data-grid';
import { UniCoreDataGrid } from '@unicore/ui';

export type StudentGridRow = {
  id: string;
  studentNumber: string;
  email: string;
  programCode: string;
  programName: string;
  currentLevel: number;
  enrollmentStatus: string;
  cumulativeGpa: number | null;
  creditHoursCompleted: number;
  academicStanding: string;
};

const columns: GridColDef<StudentGridRow>[] = [
  {
    field: 'studentNumber',
    headerName: 'Number',
    flex: 1,
    minWidth: 110,
    renderCell: ({ row, value }) => (
      <Link href={`/students/${row.id}`} style={{ color: '#1e3a5f', fontWeight: 600 }}>
        {value}
      </Link>
    ),
  },
  { field: 'email', headerName: 'Email', flex: 1.4, minWidth: 160 },
  {
    field: 'programCode',
    headerName: 'Program',
    flex: 1.6,
    minWidth: 180,
    valueGetter: (_v, row) => `${row.programCode} — ${row.programName}`,
  },
  { field: 'currentLevel', headerName: 'Level', width: 80 },
  {
    field: 'cumulativeGpa',
    headerName: 'CGPA',
    width: 88,
    renderCell: ({ row }) => {
      const v = row.cumulativeGpa;
      return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(2) : '—';
    },
  },
  {
    field: 'creditHoursCompleted',
    headerName: 'Cr earned',
    width: 98,
    renderCell: ({ row }) => {
      const v = row.creditHoursCompleted;
      return typeof v === 'number' && Number.isFinite(v) ? String(Math.round(v)) : '—';
    },
  },
  {
    field: 'academicStanding',
    headerName: 'Standing',
    width: 118,
    renderCell: ({ row }) => (row.academicStanding ? row.academicStanding : '—'),
  },
  { field: 'enrollmentStatus', headerName: 'Status', width: 120 },
];

export function StudentsDataGrid({ rows }: { rows: StudentGridRow[] }) {
  return <UniCoreDataGrid rows={rows} columns={columns} getRowId={(r: StudentGridRow) => r.id} />;
}
