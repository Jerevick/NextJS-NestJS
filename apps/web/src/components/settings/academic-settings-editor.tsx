'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { saveAcademicSettings } from '@/app/settings/academic/actions';

type Props = {
  initial: {
    studentNumberFormat: string;
    gradingSystem: string;
    semesterLabels: string;
    calendarOffsetDays: number;
  };
  entityId?: string;
  readOnly?: boolean;
  gradingScaleCount?: number;
};

const fieldStyle = { padding: '0.5rem 0.65rem', borderRadius: 8, border: '1px solid #cbd5e1' };

export function AcademicSettingsEditor({
  initial,
  entityId,
  readOnly,
  gradingScaleCount = 0,
}: Props) {
  const router = useRouter();
  const [studentNumberFormat, setStudentNumberFormat] = useState(initial.studentNumberFormat);
  const [gradingSystem, setGradingSystem] = useState(initial.gradingSystem);
  const [semesterLabels, setSemesterLabels] = useState(initial.semesterLabels);
  const [calendarOffsetDays, setCalendarOffsetDays] = useState(String(initial.calendarOffsetDays));
  const [msg, setMsg] = useState<{ error?: string; ok?: boolean } | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    const labels = semesterLabels
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    start(async () => {
      setMsg(null);
      const result = await saveAcademicSettings(
        {
          studentNumberFormat: studentNumberFormat.trim(),
          'grading.system': gradingSystem.trim(),
          'academic.semesterLabels': labels,
          'academic.calendarOffsetDays': Number(calendarOffsetDays) || 0,
        },
        entityId,
      );
      setMsg(result.error ? { error: result.error } : { ok: true });
      if ('ok' in result && result.ok) router.refresh();
    });
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <section
        style={{
          padding: '1rem',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          background: '#f8fafc',
        }}
      >
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: '#1e3a5f' }}>Grading scale</h2>
        <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>
          {gradingScaleCount > 0
            ? `${gradingScaleCount} letter-scale band(s) configured institution-wide.`
            : 'Configure letter bands and component weights for grade entry.'}
        </p>
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.88rem' }}>
          <Link
            href="/dashboard/settings/grading-weights"
            style={{ color: '#2563eb', fontWeight: 600 }}
          >
            Edit grading weights →
          </Link>
        </p>
      </section>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: '1rem', maxWidth: 520 }}>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Student number format</span>
          <input
            value={studentNumberFormat}
            onChange={(e) => setStudentNumberFormat(e.target.value)}
            disabled={readOnly || pending}
            placeholder="EXT/YYYY/[SEQ:4]"
            style={fieldStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Grading system</span>
          <select
            value={gradingSystem}
            onChange={(e) => setGradingSystem(e.target.value)}
            disabled={readOnly || pending}
            style={fieldStyle}
          >
            <option value="PERCENTAGE">Percentage</option>
            <option value="GPA">GPA</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Semester names (comma-separated)
          </span>
          <input
            value={semesterLabels}
            onChange={(e) => setSemesterLabels(e.target.value)}
            disabled={readOnly || pending}
            placeholder="Semester 1, Semester 2"
            style={fieldStyle}
          />
        </label>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Academic calendar offset (days from institution calendar)
          </span>
          <input
            type="number"
            value={calendarOffsetDays}
            onChange={(e) => setCalendarOffsetDays(e.target.value)}
            disabled={readOnly || pending}
            style={fieldStyle}
          />
        </label>
        {!readOnly && (
          <button
            type="submit"
            disabled={pending}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: 8,
              border: 'none',
              background: '#1e3a5f',
              color: '#fff',
              fontWeight: 600,
              width: 'fit-content',
            }}
          >
            Save academic settings
          </button>
        )}
        {msg?.error && <p style={{ color: '#b91c1c', fontSize: '0.88rem' }}>{msg.error}</p>}
        {msg?.ok && <p style={{ color: '#15803d', fontSize: '0.88rem' }}>Saved.</p>}
      </form>
    </div>
  );
}
