'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type CgpaTrendPoint = {
  semesterName: string;
  termGpa: number | null;
  cumulativeGpa: number | null;
};

export function CgpaTrendChart({
  points,
  height = 260,
}: {
  points: CgpaTrendPoint[];
  height?: number;
}) {
  const chartData = points
    .filter((p) => p.termGpa != null || p.cumulativeGpa != null)
    .map((p) => ({
      label: p.semesterName.length > 14 ? `${p.semesterName.slice(0, 12)}…` : p.semesterName,
      termGpa: p.termGpa ?? undefined,
      cumulativeGpa: p.cumulativeGpa ?? undefined,
    }));

  if (chartData.length === 0) {
    return (
      <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
        GPA trend appears once you have graded courses in more than one term.
      </p>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#64748b" />
          <YAxis domain={[0, 4]} tick={{ fontSize: 10 }} stroke="#64748b" />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}
            formatter={(v: number | string) => (typeof v === 'number' ? v.toFixed(2) : v)}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line
            type="monotone"
            dataKey="termGpa"
            name="Term GPA"
            stroke="#0d9488"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="cumulativeGpa"
            name="Cumulative GPA"
            stroke="#1e3a5f"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={{ r: 3 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
