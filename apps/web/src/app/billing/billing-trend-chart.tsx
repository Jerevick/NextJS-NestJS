'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type BillableTrendPoint = { date: string; total: number };

export function BillingTrendChart({
  points,
  height = 260,
  valueLabel = 'Billable',
}: {
  points: BillableTrendPoint[];
  height?: number;
  /** Tooltip / legend label (e.g. single-campus vs institution sum). */
  valueLabel?: string;
}) {
  if (points.length === 0) {
    return (
      <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
        Not enough daily snapshot rows to chart yet. Run daily snapshots for a few days.
      </p>
    );
  }
  return (
    <div style={{ width: '100%', height, fontFamily: 'ui-monospace, monospace' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#64748b" />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} stroke="#64748b" />
          <Tooltip
            contentStyle={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid #e2e8f0',
            }}
            formatter={(v: number | string) => [v, valueLabel]}
          />
          <Line type="monotone" dataKey="total" stroke="#15803d" strokeWidth={2} dot={false} name={valueLabel} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
