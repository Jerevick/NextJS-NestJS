'use client';

import { useMemo, useState, useTransition } from 'react';
import { fetchWorkloadListAction } from '@/app/staff/actions';

export type WorkloadHeatmapRow = {
  id: string;
  totalCreditHours: number;
  maxCreditHours: number;
  utilizationPct: number;
  overCapacity: boolean;
  staff: { staffNumber: string; name?: string };
};

function heatColor(utilizationPct: number, overCapacity: boolean): string {
  if (overCapacity) return '#fecaca';
  if (utilizationPct >= 90) return '#fed7aa';
  if (utilizationPct >= 75) return '#fef08a';
  if (utilizationPct >= 50) return '#d9f99d';
  return '#ecfdf5';
}

function heatBorder(utilizationPct: number, overCapacity: boolean): string {
  if (overCapacity) return '#dc2626';
  if (utilizationPct >= 90) return '#ea580c';
  if (utilizationPct >= 75) return '#ca8a04';
  return '#86efac';
}

export function StaffWorkloadHeatmap({
  initialRows,
  semesters,
  initialSemesterId,
}: {
  initialRows: WorkloadHeatmapRow[];
  semesters: Array<{ id: string; name: string }>;
  initialSemesterId?: string;
}) {
  const [semesterId, setSemesterId] = useState(initialSemesterId ?? semesters[0]?.id ?? '');
  const [rows, setRows] = useState(initialRows);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.utilizationPct - a.utilizationPct),
    [rows],
  );

  const nearCapacity = sorted.filter((w) => w.utilizationPct >= 75 || w.overCapacity).length;

  const onSemesterChange = (id: string) => {
    setSemesterId(id);
    if (!id) return;
    startTransition(async () => {
      const r = await fetchWorkloadListAction(id);
      if (r.error) {
        setError(r.error);
        return;
      }
      setError(null);
      setRows(r.data ?? []);
    });
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}
      >
        <label style={{ fontSize: '0.85rem', color: '#334155' }}>
          Semester{' '}
          <select
            value={semesterId}
            disabled={pending}
            onChange={(e) => onSemesterChange(e.target.value)}
            style={{
              marginLeft: 6,
              padding: '0.35rem 0.5rem',
              borderRadius: 6,
              border: '1px solid #e2e8f0',
            }}
          >
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
          {nearCapacity} of {sorted.length} at ≥75% capacity
          {pending ? ' · loading…' : ''}
        </span>
      </div>
      {error ? (
        <p style={{ color: '#dc2626', fontSize: '0.85rem' }}>{error}</p>
      ) : sorted.length === 0 ? (
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>No workload records.</p>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
              gap: 8,
            }}
          >
            {sorted.map((w) => (
              <div
                key={w.id}
                title={`${w.staff.staffNumber}: ${w.totalCreditHours}/${w.maxCreditHours} credit hours`}
                style={{
                  padding: '0.55rem 0.65rem',
                  borderRadius: 8,
                  border: `2px solid ${heatBorder(w.utilizationPct, w.overCapacity)}`,
                  background: heatColor(w.utilizationPct, w.overCapacity),
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>
                  {w.staff.staffNumber}
                </div>
                {w.staff.name ? (
                  <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: 2 }}>
                    {w.staff.name}
                  </div>
                ) : null}
                <div style={{ fontSize: '0.75rem', color: '#334155', marginTop: 4 }}>
                  {w.totalCreditHours}/{w.maxCreditHours} cr
                </div>
                <div
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    marginTop: 2,
                    color: w.overCapacity ? '#b91c1c' : '#0f172a',
                  }}
                >
                  {w.utilizationPct}%
                  {w.overCapacity ? ' · over' : w.utilizationPct >= 75 ? ' · high' : ''}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              marginTop: 10,
              fontSize: '0.72rem',
              color: '#64748b',
            }}
          >
            <LegendSwatch color="#ecfdf5" label="Under 50%" />
            <LegendSwatch color="#fef08a" label="75–89%" />
            <LegendSwatch color="#fed7aa" label="90–100%" />
            <LegendSwatch color="#fecaca" label="Over capacity" />
          </div>
        </>
      )}
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span>
      <span
        style={{
          display: 'inline-block',
          width: 12,
          height: 12,
          borderRadius: 2,
          background: color,
          marginRight: 4,
          verticalAlign: 'middle',
        }}
      />
      {label}
    </span>
  );
}
