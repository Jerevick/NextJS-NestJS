'use client';

import { useState, useTransition } from 'react';
import { createBookingAction, createTeamAction, fetchAtRiskAction } from '@/app/sports/actions';
import { SportsFacilityCalendar, type FacilityBookingEvent } from './sports-facility-calendar';

const panel: React.CSSProperties = {
  padding: '1.25rem',
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  background: '#fff',
};

const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  borderRadius: 8,
  border: '1px solid #cbd5e1',
  width: '100%',
};

const btn: React.CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: 8,
  border: 'none',
  background: '#059669',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600,
};

export function SportsHub({
  teams,
  fixtures,
  facilities,
  bookings,
  awards,
  canWrite,
  sportTypes,
}: {
  teams: Array<{
    id: string;
    name: string;
    sportType?: { name: string };
    _count?: { players: number };
  }>;
  fixtures: Array<{
    id: string;
    scheduledAt: string;
    homeTeam?: { name: string };
    awayTeam?: { name: string };
    status: string;
  }>;
  facilities: Array<{ id: string; name: string; type: string }>;
  bookings: FacilityBookingEvent[];
  awards: Array<{ id: string; title: string; awardedAt: string }>;
  canWrite: boolean;
  sportTypes: Array<{ id: string; name: string }>;
}) {
  const [atRisk, setAtRisk] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <section style={panel}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>Teams</h2>
        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {teams.map((t) => (
            <li key={t.id}>
              {t.name}
              {t.sportType ? ` (${t.sportType.name})` : ''} · {t._count?.players ?? 0} players
            </li>
          ))}
        </ul>
        {canWrite && sportTypes[0] ? (
          <form
            style={{ marginTop: 12, display: 'grid', gap: 8 }}
            onSubmit={(ev) => {
              ev.preventDefault();
              const fd = new FormData(ev.currentTarget);
              start(async () => {
                const r = await createTeamAction({
                  name: String(fd.get('name')),
                  sportTypeId: String(fd.get('sportTypeId')),
                });
                setMessage(r.error ?? 'Team created');
              });
            }}
          >
            <input name="name" placeholder="Team name" style={inputStyle} required />
            <select name="sportTypeId" style={inputStyle} required>
              {sportTypes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button type="submit" style={btn} disabled={pending}>
              Add team
            </button>
          </form>
        ) : null}
      </section>

      <section style={panel}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>Fixtures</h2>
        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {fixtures.map((f) => (
            <li key={f.id}>
              {f.homeTeam?.name ?? 'TBD'} vs {f.awayTeam?.name ?? 'TBD'} —{' '}
              {new Date(f.scheduledAt).toLocaleString()} ({f.status})
            </li>
          ))}
        </ul>
      </section>

      <section style={panel}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>Facility bookings</h2>
        <SportsFacilityCalendar events={bookings} />
        {canWrite && facilities[0] ? (
          <form
            style={{ marginTop: 12, display: 'grid', gap: 8 }}
            onSubmit={(ev) => {
              ev.preventDefault();
              const fd = new FormData(ev.currentTarget);
              start(async () => {
                const r = await createBookingAction({
                  facilityId: String(fd.get('facilityId')),
                  purpose: String(fd.get('purpose')),
                  startTime: String(fd.get('startTime')),
                  endTime: String(fd.get('endTime')),
                });
                setMessage(r.error ?? 'Booking created');
              });
            }}
          >
            <select name="facilityId" style={inputStyle} required>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.type})
                </option>
              ))}
            </select>
            <input name="purpose" placeholder="Purpose" style={inputStyle} required />
            <input name="startTime" type="datetime-local" style={inputStyle} required />
            <input name="endTime" type="datetime-local" style={inputStyle} required />
            <button type="submit" style={btn} disabled={pending}>
              Book facility
            </button>
          </form>
        ) : null}
      </section>

      <section style={panel}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>Awards & records</h2>
        <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
          {awards.map((a) => (
            <li key={a.id}>
              {a.title} — {new Date(a.awardedAt).toLocaleDateString()}
            </li>
          ))}
        </ul>
      </section>

      <section style={panel}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>GPA eligibility alerts</h2>
        <button
          type="button"
          style={btn}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await fetchAtRiskAction();
              if ('error' in r && r.error) setMessage(r.error);
              else setAtRisk('data' in r ? r.data : null);
            })
          }
        >
          Check at-risk players
        </button>
        {atRisk ? (
          <pre style={{ marginTop: 12, fontSize: '0.75rem', overflow: 'auto' }}>
            {JSON.stringify(atRisk, null, 2)}
          </pre>
        ) : null}
      </section>

      {message ? <p style={{ color: '#64748b', fontSize: '0.9rem' }}>{message}</p> : null}
    </div>
  );
}
