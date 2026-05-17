'use client';

import Link from 'next/link';
import type { GridColDef } from '@mui/x-data-grid';
import { UniCoreDataGrid } from '@unicore/ui';

export type InstitutionGridRow = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  healthScore: string;
  students: string;
};

const columns: GridColDef<InstitutionGridRow>[] = [
  {
    field: 'name',
    headerName: 'Name',
    flex: 1.2,
    minWidth: 160,
    renderCell: ({ row, value }) => (
      <Link href={`/institutions/${row.id}`} style={{ color: '#60a5fa' }}>
        {value}
      </Link>
    ),
  },
  { field: 'slug', headerName: 'Slug', flex: 1, minWidth: 120 },
  { field: 'plan', headerName: 'Plan', width: 100 },
  { field: 'status', headerName: 'Status', width: 100 },
  { field: 'healthScore', headerName: 'Health', width: 90 },
  { field: 'students', headerName: 'Students', width: 100 },
];

export function InstitutionsDataGrid({ rows }: { rows: InstitutionGridRow[] }) {
  return (
    <UniCoreDataGrid rows={rows} columns={columns} getRowId={(r: InstitutionGridRow) => r.id} />
  );
}

export type EntityGridRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  activeStudentCount: number;
};

const entityColumns: GridColDef<EntityGridRow>[] = [
  { field: 'code', headerName: 'Code', width: 100 },
  { field: 'name', headerName: 'Name', flex: 1.2, minWidth: 160 },
  { field: 'type', headerName: 'Type', width: 140 },
  { field: 'activeStudentCount', headerName: 'Active students', width: 130 },
];

export function InstitutionEntitiesDataGrid({ rows }: { rows: EntityGridRow[] }) {
  return (
    <UniCoreDataGrid rows={rows} columns={entityColumns} getRowId={(r: EntityGridRow) => r.id} />
  );
}

export type AdminInvoiceGridRow = {
  id: string;
  institutionName: string;
  status: string;
  amount: string;
  period: string;
};

const adminInvoiceColumns: GridColDef<AdminInvoiceGridRow>[] = [
  { field: 'institutionName', headerName: 'Institution', flex: 1.2, minWidth: 160 },
  { field: 'status', headerName: 'Status', width: 100 },
  { field: 'amount', headerName: 'Amount', width: 110 },
  { field: 'period', headerName: 'Period', width: 100 },
  {
    field: 'id',
    headerName: 'Id',
    flex: 1,
    minWidth: 120,
    valueFormatter: (v) => `${String(v).slice(0, 12)}…`,
  },
];

export function AdminInvoicesDataGrid({ rows }: { rows: AdminInvoiceGridRow[] }) {
  return (
    <UniCoreDataGrid
      rows={rows}
      columns={adminInvoiceColumns}
      getRowId={(r: AdminInvoiceGridRow) => r.id}
    />
  );
}

export type AdminDisputeGridRow = {
  id: string;
  institutionName: string;
  status: string;
  invoiceLabel: string;
  amount: string;
  createdAt: string;
};

const adminDisputeColumns: GridColDef<AdminDisputeGridRow>[] = [
  {
    field: 'institutionName',
    headerName: 'Institution',
    flex: 1.2,
    minWidth: 160,
    renderCell: ({ row, value }) => (
      <Link href={`/billing/disputes/${row.id}`} style={{ color: '#60a5fa' }}>
        {value}
      </Link>
    ),
  },
  { field: 'status', headerName: 'Status', width: 100 },
  { field: 'invoiceLabel', headerName: 'Invoice', width: 120 },
  { field: 'amount', headerName: 'Amount', width: 100 },
  {
    field: 'createdAt',
    headerName: 'Created',
    width: 120,
    valueFormatter: (v) => (v ? new Date(String(v)).toLocaleDateString() : '—'),
  },
];

export function AdminDisputesDataGrid({ rows }: { rows: AdminDisputeGridRow[] }) {
  return (
    <UniCoreDataGrid
      rows={rows}
      columns={adminDisputeColumns}
      getRowId={(r: AdminDisputeGridRow) => r.id}
    />
  );
}
