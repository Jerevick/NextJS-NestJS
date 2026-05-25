'use client';

import Link from 'next/link';
import type { GridColDef } from '@mui/x-data-grid';
import { UniCoreDataGrid } from '@unicore/ui';

export type InvoiceGridRow = {
  id: string;
  status: string;
  amount: string;
  isRetroactive: boolean;
  lockedAt: string | null;
  dueDate: string | null;
  overdue: boolean;
};

const invoiceColumns: GridColDef<InvoiceGridRow>[] = [
  { field: 'status', headerName: 'Status', width: 100 },
  { field: 'amount', headerName: 'Amount', width: 110 },
  {
    field: 'isRetroactive',
    headerName: 'Retro',
    width: 70,
    valueFormatter: (v) => (v ? 'yes' : '—'),
  },
  {
    field: 'lockedAt',
    headerName: 'Locked',
    width: 80,
    valueFormatter: (v) => (v ? 'yes' : '—'),
  },
  {
    field: 'dueDate',
    headerName: 'Due',
    width: 130,
    renderCell: ({ row, value }) => (
      <span style={{ color: row.overdue ? '#b91c1c' : undefined }}>
        {value ? String(value).slice(0, 10) : '—'}
        {row.overdue ? ' overdue' : ''}
      </span>
    ),
  },
  {
    field: 'id',
    headerName: 'Id',
    flex: 1,
    minWidth: 140,
    renderCell: ({ row }) => (
      <>
        <Link
          href={`/dashboard/billing/invoice/${encodeURIComponent(row.id)}`}
          style={{ color: '#2563eb' }}
        >
          View
        </Link>
        <span style={{ color: '#94a3b8', margin: '0 0.35rem' }}>|</span>
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem' }}>
          {row.id.slice(0, 10)}…
        </span>
      </>
    ),
  },
];

export function BillingInvoicesDataGrid({ rows }: { rows: InvoiceGridRow[] }) {
  return (
    <UniCoreDataGrid rows={rows} columns={invoiceColumns} getRowId={(r: InvoiceGridRow) => r.id} />
  );
}

export type MonthlySummaryGridRow = {
  id: string;
  campus: string;
  watermarkCount: number;
  peakDailyCount: number;
  averageDailyCount: string;
};

const summaryColumns: GridColDef<MonthlySummaryGridRow>[] = [
  { field: 'campus', headerName: 'Campus', flex: 1.4, minWidth: 180 },
  { field: 'watermarkCount', headerName: 'Watermark', width: 110 },
  { field: 'peakDailyCount', headerName: 'Peak', width: 90 },
  { field: 'averageDailyCount', headerName: 'Avg', width: 90 },
];

export function BillingSummariesDataGrid({ rows }: { rows: MonthlySummaryGridRow[] }) {
  return (
    <UniCoreDataGrid
      rows={rows}
      columns={summaryColumns}
      getRowId={(r: MonthlySummaryGridRow) => r.id}
    />
  );
}

export type DailySnapshotGridRow = {
  id: string;
  snapshotDate: string;
  campus: string;
  billableCount: number;
  isLockedForBilling: boolean;
};

const snapshotColumns: GridColDef<DailySnapshotGridRow>[] = [
  {
    field: 'snapshotDate',
    headerName: 'Date (UTC)',
    width: 120,
    valueFormatter: (v) => (v ? String(v).slice(0, 10) : '—'),
  },
  { field: 'campus', headerName: 'Campus', flex: 1, minWidth: 120 },
  { field: 'billableCount', headerName: 'Billable', width: 100 },
  {
    field: 'isLockedForBilling',
    headerName: 'Locked',
    width: 90,
    valueFormatter: (v) => (v ? 'yes' : '—'),
  },
];

export function BillingSnapshotsDataGrid({ rows }: { rows: DailySnapshotGridRow[] }) {
  return (
    <UniCoreDataGrid
      rows={rows}
      columns={snapshotColumns}
      getRowId={(r: DailySnapshotGridRow) => r.id}
    />
  );
}
