'use client';

import { useFormState, useFormStatus } from 'react-dom';
import {
  applyTimetableOption,
  generateSemesterTimetable,
  type TimetableAssistantState,
  type TimetableOption,
} from './actions';

const initial: TimetableAssistantState = {};

function GenerateButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{ padding: '0.6rem 1.1rem', fontWeight: 600, borderRadius: 8 }}
    >
      {pending ? 'Generating…' : 'Generate schedule options'}
    </button>
  );
}

function OptionCard({ option, index }: { option: TimetableOption; index: number }) {
  const [, applyAction] = useFormState(applyTimetableOption, initial);

  return (
    <article
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: '1rem 1.1rem',
        background: '#fff',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: '0.75rem',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a' }}>Option {index + 1}</h3>
        <span style={{ fontWeight: 700, color: '#059669' }}>Score {option.score}</span>
      </header>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
        Room utilisation {(option.metrics.roomUtilization * 100).toFixed(0)}% · Faculty spread{' '}
        {option.metrics.facultySpread.toFixed(1)}
      </p>
      <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#475569' }}>
            <th style={{ padding: '0.35rem 0' }}>Course</th>
            <th>Day</th>
            <th>Time</th>
            <th>Room</th>
          </tr>
        </thead>
        <tbody>
          {option.assignments.map((a) => (
            <tr key={`${a.sectionId}-${a.day}`} style={{ borderTop: '1px solid #f1f5f9' }}>
              <td style={{ padding: '0.4rem 0' }}>{a.courseCode}</td>
              <td>{a.day}</td>
              <td>
                {a.startTime}–{a.endTime}
              </td>
              <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {a.roomId.slice(0, 8)}…
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form action={applyAction} style={{ marginTop: '0.85rem' }}>
        <input type="hidden" name="optionJson" value={JSON.stringify(option)} />
        <ApplyButton />
      </form>
    </article>
  );
}

function ApplyButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: '0.45rem 0.9rem',
        borderRadius: 8,
        border: '1px solid #2563eb',
        background: '#eff6ff',
        color: '#1d4ed8',
        fontWeight: 600,
        fontSize: '0.88rem',
      }}
    >
      {pending ? 'Applying…' : 'Apply this option'}
    </button>
  );
}

export function TimetablingAssistantForm({
  semesters,
}: {
  semesters: { id: string; name: string; startDate: string }[];
}) {
  const [state, formAction] = useFormState(generateSemesterTimetable, initial);

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <form action={formAction} style={{ display: 'grid', gap: '1rem', maxWidth: 720 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontWeight: 600 }}>
          Semester
          <select
            name="semesterId"
            required
            defaultValue=""
            style={{ padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid #cbd5e1' }}
          >
            <option value="" disabled>
              Choose semester…
            </option>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({new Date(s.startDate).toLocaleDateString()})
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontWeight: 600 }}>
          Constraints (one per line)
          <textarea
            name="constraints"
            rows={4}
            placeholder={'No Friday\nMorning only\nAvoid Tuesday for labs'}
            style={{
              padding: '0.5rem 0.6rem',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontFamily: 'inherit',
            }}
          />
        </label>
        <label
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            fontSize: '0.88rem',
            color: '#475569',
          }}
        >
          <input type="checkbox" name="includeAiNarrative" />
          Include AI comparison narrative
        </label>
        <GenerateButton />
      </form>

      {state.error ? <p style={{ color: '#b91c1c', margin: 0 }}>{state.error}</p> : null}
      {state.applied ? (
        <p style={{ color: '#059669', margin: 0, fontWeight: 600 }}>
          Applied {state.applied.count} section schedule(s).
        </p>
      ) : null}

      {state.result ? (
        <section style={{ display: 'grid', gap: '1rem' }}>
          <p style={{ margin: 0, color: '#475569', fontSize: '0.92rem' }}>
            {state.result.sectionsToSchedule} section(s) to schedule · Engine:{' '}
            <strong>{state.result.engine}</strong>
            {state.result.constraintsApplied?.notes.length ? (
              <> · Constraints: {state.result.constraintsApplied.notes.join('; ')}</>
            ) : null}
          </p>
          {state.result.narrative ? (
            <div
              style={{
                padding: '1rem',
                background: '#f8fafc',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                fontSize: '0.92rem',
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
              }}
            >
              <strong style={{ display: 'block', marginBottom: 6, color: '#0f172a' }}>
                AI summary {state.result.isAIGenerated ? '(generated)' : ''}
              </strong>
              {state.result.narrative}
            </div>
          ) : null}
          {!state.result.options.length ? (
            <p style={{ color: '#b45309' }}>
              No conflict-free options found. Relax constraints or add rooms/time slots.
            </p>
          ) : (
            state.result.options.map((opt, i) => <OptionCard key={i} option={opt} index={i} />)
          )}
        </section>
      ) : null}
    </div>
  );
}
