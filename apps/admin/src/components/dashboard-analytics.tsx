'use client';

import { useEffect, useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

type MrrMonth = { month: string; revenue: string };
type MapPin = {
  id: string;
  name: string;
  plan: string;
  status: string;
  students: number;
  coordinates: { lat: number; lng: number };
};

export function DashboardAnalytics({
  mrrMonths,
  pins,
  initialOnline,
}: {
  mrrMonths: MrrMonth[];
  pins: MapPin[];
  initialOnline: number;
}) {
  const [online, setOnline] = useState(initialOnline);
  const chartData = useMemo(
    () =>
      mrrMonths.map((m) => ({
        month: m.month,
        revenue: Number.parseFloat(m.revenue) || 0,
      })),
    [mrrMonths],
  );

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/active-sessions', { cache: 'no-store' });
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as { totalOnline?: number };
        if (typeof data.totalOnline === 'number') {
          setOnline(data.totalOnline);
        }
      } catch {
        /* ignore poll errors */
      }
    };
    void poll();
    const id = setInterval(() => void poll(), 30_000);
    return () => clearInterval(id);
  }, []);

  const mono = { fontFamily: 'ui-monospace, monospace' } as const;

  return (
    <div style={{ display: 'grid', gap: '1.5rem', marginTop: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          border: '1px solid #1e293b',
          borderRadius: 8,
          background: '#0a0a0a',
        }}
      >
        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Users online (15m)</span>
        <span style={{ fontSize: '1.5rem', color: '#22c55e', ...mono }}>{online}</span>
      </div>

      <section>
        <h2 style={{ fontSize: '1rem', margin: '0 0 0.75rem', color: '#e2e8f0' }}>
          MRR trend (paid invoices, 12mo)
        </h2>
        <div style={{ height: 220, background: '#111', borderRadius: 8, padding: '0.5rem' }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155' }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: '#64748b', fontSize: '0.85rem', padding: '1rem' }}>
              No revenue data yet.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '1rem', margin: '0 0 0.75rem', color: '#e2e8f0' }}>
          Institutions map
        </h2>
        <div
          style={{
            height: 280,
            background: '#0a0a0a',
            border: '1px solid #1e293b',
            borderRadius: 8,
          }}
        >
          <ComposableMap projectionConfig={{ scale: 140 }}>
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="#1e293b"
                    stroke="#334155"
                    style={{
                      default: { outline: 'none' },
                      hover: { outline: 'none' },
                      pressed: { outline: 'none' },
                    }}
                  />
                ))
              }
            </Geographies>
            {pins.map((pin) => (
              <Marker key={pin.id} coordinates={[pin.coordinates.lng, pin.coordinates.lat]}>
                <circle r={4} fill="#3b82f6" stroke="#fff" strokeWidth={1}>
                  <title>{`${pin.name} (${pin.plan})`}</title>
                </circle>
              </Marker>
            ))}
          </ComposableMap>
        </div>
      </section>
    </div>
  );
}
