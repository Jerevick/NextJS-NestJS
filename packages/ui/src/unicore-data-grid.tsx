'use client';

import { DataGrid, type DataGridProps } from '@mui/x-data-grid';

const defaultPageSize = 25;

export type UniCoreDataGridProps = DataGridProps;

export function UniCoreDataGrid(props: UniCoreDataGridProps) {
  const {
    autoHeight = true,
    disableRowSelectionOnClick = true,
    pageSizeOptions = [10, 25, 50, 100],
    initialState,
    sx,
    ...rest
  } = props;
  const rowCount = Array.isArray(rest.rows) ? rest.rows.length : 0;

  return (
    <div style={{ width: '100%', minHeight: rowCount === 0 ? 120 : undefined }}>
      <DataGrid
        autoHeight={autoHeight}
        disableRowSelectionOnClick={disableRowSelectionOnClick}
        pageSizeOptions={pageSizeOptions}
        initialState={{
          pagination: { paginationModel: { pageSize: defaultPageSize } },
          ...initialState,
        }}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: (t) => (t.palette.mode === 'dark' ? '#1e293b' : '#f8fafc'),
          },
          '& .MuiDataGrid-cell:focus': { outline: 'none' },
          ...sx,
        }}
        {...rest}
      />
    </div>
  );
}
