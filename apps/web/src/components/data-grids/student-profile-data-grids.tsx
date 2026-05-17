'use client';

import type { GridColDef } from '@mui/x-data-grid';
import { UniCoreDataGrid } from '@unicore/ui';
import { DropEnrollmentForm } from '@/app/students/[id]/drop-enrollment-form';

export type EnrollmentGridRow = {
  id: string;
  courseLabel: string;
  semesterName: string;
  status: string;
  creditHours: number;
  enrollmentAttemptNumber: number;
  enrolledAt: string;
  showDrop: boolean;
};

export function StudentEnrollmentsDataGrid({
  rows,
  profilePath,
  profileReadOnly,
  showActions,
}: {
  rows: EnrollmentGridRow[];
  profilePath: string;
  profileReadOnly: boolean;
  showActions: boolean;
}) {
  const columns: GridColDef<EnrollmentGridRow>[] = [
    { field: 'courseLabel', headerName: 'Course', flex: 1.4, minWidth: 200 },
    { field: 'semesterName', headerName: 'Semester', flex: 1, minWidth: 120 },
    { field: 'status', headerName: 'Status', width: 110 },
    { field: 'enrollmentAttemptNumber', headerName: 'Attempt', width: 90 },
    { field: 'creditHours', headerName: 'Credits', width: 90 },
    { field: 'enrolledAt', headerName: 'Enrolled', width: 120 },
  ];

  if (showActions) {
    columns.push({
      field: 'id',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) =>
        row.showDrop ? (
          <DropEnrollmentForm
            enrollmentId={row.id}
            studentProfilePath={profilePath}
            readOnly={profileReadOnly}
          />
        ) : (
          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>—</span>
        ),
    });
  }

  return (
    <UniCoreDataGrid rows={rows} columns={columns} getRowId={(r: EnrollmentGridRow) => r.id} />
  );
}

export type DocumentGridRow = {
  id: string;
  type: string;
  title: string;
  status: string;
  requestedAt: string;
  issuedAt: string;
};

const documentColumns: GridColDef<DocumentGridRow>[] = [
  { field: 'type', headerName: 'Type', width: 120 },
  { field: 'title', headerName: 'Title', flex: 1.2, minWidth: 160 },
  { field: 'status', headerName: 'Status', width: 110 },
  { field: 'requestedAt', headerName: 'Requested', width: 120 },
  { field: 'issuedAt', headerName: 'Issued', width: 120 },
];

export function StudentDocumentsDataGrid({ rows }: { rows: DocumentGridRow[] }) {
  return (
    <UniCoreDataGrid
      rows={rows}
      columns={documentColumns}
      getRowId={(r: DocumentGridRow) => r.id}
    />
  );
}

export type AttendanceSectionGridRow = {
  id: string;
  sectionId: string;
  total: number;
};

const attendanceSectionColumns: GridColDef<AttendanceSectionGridRow>[] = [
  {
    field: 'sectionId',
    headerName: 'Section',
    flex: 1,
    minWidth: 140,
    valueFormatter: (v) => `${String(v).slice(0, 12)}…`,
  },
  { field: 'total', headerName: 'Sessions', width: 100 },
];

export function StudentAttendanceSectionsDataGrid({ rows }: { rows: AttendanceSectionGridRow[] }) {
  return (
    <UniCoreDataGrid
      rows={rows}
      columns={attendanceSectionColumns}
      getRowId={(r: AttendanceSectionGridRow) => r.id}
      pageSizeOptions={[5, 10, 25]}
    />
  );
}
