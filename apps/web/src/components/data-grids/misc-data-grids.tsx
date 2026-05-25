'use client';

import Link from 'next/link';
import type { GridColDef } from '@mui/x-data-grid';
import { UniCoreDataGrid } from '@unicore/ui';

export type ReactivationGridRow = {
  id: string;
  status: string;
  studentLabel: string;
  campus: string;
  createdAt: string;
};

const reactivationColumns: GridColDef<ReactivationGridRow>[] = [
  { field: 'status', headerName: 'Status', width: 120 },
  { field: 'studentLabel', headerName: 'Student', flex: 1.2, minWidth: 160 },
  { field: 'campus', headerName: 'Campus', width: 110 },
  {
    field: 'createdAt',
    headerName: 'Created',
    width: 160,
    renderCell: ({ row, value }) => (
      <Link
        href={`/dashboard/students/reactivation/${encodeURIComponent(row.id)}`}
        style={{ color: '#2563eb' }}
      >
        {value ? String(value).slice(0, 19) : '—'}
      </Link>
    ),
  },
];

export function ReactivationRequestsDataGrid({ rows }: { rows: ReactivationGridRow[] }) {
  return (
    <UniCoreDataGrid
      rows={rows}
      columns={reactivationColumns}
      getRowId={(r: ReactivationGridRow) => r.id}
    />
  );
}

export type PositionGridRow = {
  id: string;
  titleLabel: string;
  unitLabel: string;
  level: number;
  holderLabel: string;
};

const positionColumns: GridColDef<PositionGridRow>[] = [
  { field: 'titleLabel', headerName: 'Title', flex: 1.2, minWidth: 160 },
  { field: 'unitLabel', headerName: 'Unit', flex: 1.2, minWidth: 160 },
  {
    field: 'level',
    headerName: 'Level',
    width: 80,
    valueFormatter: (v) => `L${v}`,
  },
  { field: 'holderLabel', headerName: 'Holder', flex: 1.2, minWidth: 180 },
];

export function PositionsDataGrid({ rows }: { rows: PositionGridRow[] }) {
  return (
    <UniCoreDataGrid
      rows={rows}
      columns={positionColumns}
      getRowId={(r: PositionGridRow) => r.id}
    />
  );
}

export type BillingDisputeGridRow = {
  id: string;
  status: string;
  invoiceLabel: string;
  invoiceId: string | null;
  createdAt: string;
  reason: string;
};

const disputeColumns: GridColDef<BillingDisputeGridRow>[] = [
  { field: 'status', headerName: 'Status', width: 110 },
  {
    field: 'invoiceLabel',
    headerName: 'Invoice',
    flex: 1,
    minWidth: 140,
    renderCell: ({ row, value }) =>
      row.invoiceId ? (
        <Link
          href={`/dashboard/billing/invoice/${encodeURIComponent(row.invoiceId)}`}
          style={{ color: '#2563eb' }}
        >
          {value}
        </Link>
      ) : (
        '—'
      ),
  },
  {
    field: 'createdAt',
    headerName: 'Created',
    width: 160,
    valueFormatter: (v) => (v ? String(v).slice(0, 19) : '—'),
  },
  {
    field: 'reason',
    headerName: 'Reason',
    flex: 1.4,
    minWidth: 200,
    renderCell: ({ row, value }) => (
      <span>
        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value}
        </span>
        <Link
          href={`/dashboard/billing/disputes/${encodeURIComponent(row.id)}`}
          style={{ color: '#2563eb', fontSize: '0.8rem' }}
        >
          Detail
        </Link>
      </span>
    ),
  },
];

export function BillingDisputesDataGrid({ rows }: { rows: BillingDisputeGridRow[] }) {
  return (
    <UniCoreDataGrid
      rows={rows}
      columns={disputeColumns}
      getRowId={(r: BillingDisputeGridRow) => r.id}
    />
  );
}

export type SnapshotHistoryGridRow = {
  id: string;
  date: string;
  entityName: string;
  billableCount: number;
  isLockedForBilling: boolean;
};

const snapshotHistoryColumns: GridColDef<SnapshotHistoryGridRow>[] = [
  { field: 'date', headerName: 'Date', width: 120 },
  { field: 'entityName', headerName: 'Entity', flex: 1, minWidth: 140 },
  { field: 'billableCount', headerName: 'Billable count', width: 120 },
  {
    field: 'isLockedForBilling',
    headerName: 'Locked',
    width: 90,
    valueFormatter: (v) => (v ? 'Yes' : '—'),
  },
];

export function SnapshotHistoryDataGrid({ rows }: { rows: SnapshotHistoryGridRow[] }) {
  return (
    <UniCoreDataGrid
      rows={rows}
      columns={snapshotHistoryColumns}
      getRowId={(r: SnapshotHistoryGridRow) => r.id}
    />
  );
}

export type BulkEnrollResultRow = {
  id: string;
  studentId: string;
  result: string;
  ok: boolean;
};

const bulkResultColumns: GridColDef<BulkEnrollResultRow>[] = [
  { field: 'studentId', headerName: 'Student id', flex: 1.2, minWidth: 160 },
  {
    field: 'result',
    headerName: 'Result',
    flex: 1,
    minWidth: 120,
    renderCell: ({ row, value }) => (
      <span style={{ color: row.ok ? '#15803d' : '#b91c1c' }}>{value}</span>
    ),
  },
];

export function BulkEnrollResultDataGrid({ rows }: { rows: BulkEnrollResultRow[] }) {
  return (
    <UniCoreDataGrid
      rows={rows}
      columns={bulkResultColumns}
      getRowId={(r: BulkEnrollResultRow) => r.id}
      autoHeight
      initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
    />
  );
}
