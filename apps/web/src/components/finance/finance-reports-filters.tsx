'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export function FinanceReportsFilters({
  departments,
  defaultFrom,
  defaultTo,
}: {
  departments: Array<{ id: string; name: string }>;
  defaultFrom: string;
  defaultTo: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const from = searchParams.get('from') ?? defaultFrom;
  const to = searchParams.get('to') ?? defaultTo;
  const departmentId = searchParams.get('departmentId') ?? '';

  const apply = useCallback(
    (next: { from?: string; to?: string; departmentId?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.from !== undefined) {
        if (next.from) params.set('from', next.from);
        else params.delete('from');
      }
      if (next.to !== undefined) {
        if (next.to) params.set('to', next.to);
        else params.delete('to');
      }
      if (next.departmentId !== undefined) {
        if (next.departmentId) params.set('departmentId', next.departmentId);
        else params.delete('departmentId');
      }
      router.push(`/finance?${params.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <form
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: '1rem',
        alignItems: 'end',
      }}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        apply({
          from: String(fd.get('from') ?? ''),
          to: String(fd.get('to') ?? ''),
          departmentId: String(fd.get('departmentId') ?? ''),
        });
      }}
    >
      <label style={{ display: 'grid', gap: 4, fontSize: '0.82rem' }}>
        From
        <input type="date" name="from" defaultValue={from.slice(0, 10)} style={inputStyle} />
      </label>
      <label style={{ display: 'grid', gap: 4, fontSize: '0.82rem' }}>
        To
        <input type="date" name="to" defaultValue={to.slice(0, 10)} style={inputStyle} />
      </label>
      {departments.length > 0 ? (
        <label style={{ display: 'grid', gap: 4, fontSize: '0.82rem' }}>
          Department
          <select name="departmentId" defaultValue={departmentId} style={inputStyle}>
            <option value="">All in scope</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button type="submit" style={btnStyle}>
        Apply filters
      </button>
    </form>
  );
}

const inputStyle = {
  padding: '0.4rem 0.55rem',
  borderRadius: 8,
  border: '1px solid #e2e8f0',
} as const;

const btnStyle = {
  padding: '0.45rem 0.9rem',
  borderRadius: 8,
  border: 'none',
  background: '#1e3a5f',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
} as const;
