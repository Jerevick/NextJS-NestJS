'use client';

import { useEffect, useState } from 'react';

type Conflict = {
  existingSectionId: string;
  existingCourseCode: string;
  day: string;
  existingStart: string;
  existingEnd: string;
  newStart: string;
  newEnd: string;
};

export function EnrollConflictHint({
  studentId,
  sectionId,
  accessToken,
  apiBase,
}: {
  studentId: string;
  sectionId: string | null;
  accessToken: string;
  apiBase: string;
}) {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sectionId) {
      setConflicts([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      const qs = new URLSearchParams({ studentId, sectionId });
      const res = await fetch(`${apiBase}/enrollments/conflicts/preview?${qs}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (cancelled) {
        return;
      }
      if (!res.ok) {
        setConflicts([]);
        setLoading(false);
        return;
      }
      const body = (await res.json()) as { conflicts?: Conflict[] };
      setConflicts(body.conflicts ?? []);
      setLoading(false);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [studentId, sectionId, accessToken, apiBase]);

  if (!sectionId) {
    return null;
  }
  if (loading) {
    return <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>Checking timetable…</p>;
  }
  if (conflicts.length === 0) {
    return (
      <p style={{ fontSize: '0.85rem', color: '#166534', margin: 0 }}>
        No timetable conflicts detected.
      </p>
    );
  }
  return (
    <div
      role="alert"
      style={{
        padding: '0.75rem 1rem',
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: 8,
        fontSize: '0.9rem',
      }}
    >
      <strong style={{ color: '#b91c1c' }}>Timetable conflict</strong>
      <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', color: '#7f1d1d' }}>
        {conflicts.map((c) => (
          <li key={`${c.existingSectionId}-${c.day}-${c.existingStart}`}>
            Overlaps with {c.existingCourseCode} on {c.day} ({c.existingStart}–{c.existingEnd} vs
            proposed {c.newStart}–{c.newEnd})
          </li>
        ))}
      </ul>
    </div>
  );
}
