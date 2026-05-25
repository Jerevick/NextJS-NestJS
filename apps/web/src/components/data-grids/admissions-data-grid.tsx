'use client';

import Link from 'next/link';
import type { GridColDef } from '@mui/x-data-grid';
import { UniCoreDataGrid } from '@unicore/ui';

export type ApplicationGridRow = {
  id: string;
  applicantName: string;
  programLabel: string;
  cycleName: string;
  status: string;
  acceptedStudentId: string | null;
  createdAt: string;
};

const columns: GridColDef<ApplicationGridRow>[] = [
  {
    field: 'applicantName',
    headerName: 'Applicant',
    flex: 1.2,
    minWidth: 160,
    renderCell: ({ row, value }) => (
      <Link href={`/dashboard/admissions/${row.id}`} style={{ color: '#1e3a5f', fontWeight: 600 }}>
        {value}
      </Link>
    ),
  },
  { field: 'programLabel', headerName: 'Program', flex: 1.4, minWidth: 180 },
  { field: 'cycleName', headerName: 'Cycle', flex: 1, minWidth: 120 },
  {
    field: 'status',
    headerName: 'Status',
    width: 140,
    renderCell: ({ row, value }) => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            background: value === 'ACCEPTED' ? '#dcfce7' : '#f1f5f9',
            padding: '0.15rem 0.5rem',
            borderRadius: 4,
            fontSize: '0.8rem',
          }}
        >
          {value}
        </span>
        {row.acceptedStudentId ? (
          <span style={{ color: '#15803d', fontSize: '0.75rem' }}>enrolled</span>
        ) : null}
      </span>
    ),
  },
  {
    field: 'createdAt',
    headerName: 'Submitted',
    width: 120,
    valueFormatter: (v) => (v ? new Date(String(v)).toLocaleDateString() : '—'),
  },
];

export function AdmissionsDataGrid({ rows }: { rows: ApplicationGridRow[] }) {
  return (
    <UniCoreDataGrid rows={rows} columns={columns} getRowId={(r: ApplicationGridRow) => r.id} />
  );
}
