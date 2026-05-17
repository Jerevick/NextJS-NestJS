type GpaPayload = {
  policy: string;
  cumulativeGpa: number | null;
  creditHoursGradedUsed: number;
  contributions: { courseId: string; gradePoints: number; creditHours: number }[];
};

type DecisionRow = { id: string; kind: string; createdAt: string };
type ProgressionHoldRow = { id: string; type: string; reason: string | null; createdAt: string };
type CarryRow = {
  id: string;
  original: { enrollmentId: string; courseCode: string; semesterName: string | null };
  repeat: { enrollmentId: string; courseCode: string; semesterName: string | null };
};

export function StudentProgressionInsights({
  primary,
  muted,
  border,
  gpa,
  decisions,
  progressionHolds,
  carryovers,
}: {
  primary: string;
  muted: string;
  border: string;
  gpa: GpaPayload | null;
  decisions: DecisionRow[];
  progressionHolds: ProgressionHoldRow[];
  carryovers: CarryRow[];
}) {
  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2
        style={{
          fontFamily: '"Crimson Pro", Georgia, serif',
          fontSize: '1.35rem',
          color: primary,
          marginBottom: '0.75rem',
        }}
      >
        Academic progression (Phase 19)
      </h2>
      <p style={{ color: muted, fontSize: '0.85rem', marginBottom: '1rem', maxWidth: 640 }}>
        GPA uses the institution&apos;s repeat policy across course attempts. Separate from
        administrative enrollment holds — progression holds flag promotion or repeat decisions.
      </p>

      {gpa ? (
        <div
          style={{
            border: `1px solid ${border}`,
            borderRadius: 8,
            padding: '1rem',
            marginBottom: '1rem',
            background: '#f8fafc',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600, color: primary }}>
            GPA breakdown · policy: <span style={{ fontWeight: 700 }}>{gpa.policy}</span>
          </p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.95rem', color: muted }}>
            CGPA {gpa.cumulativeGpa !== null ? gpa.cumulativeGpa : '—'} · Graded credits in policy{' '}
            <strong>{gpa.creditHoursGradedUsed}</strong>
          </p>
          {gpa.contributions.length > 0 ? (
            <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.2rem', fontSize: '0.88rem' }}>
              {gpa.contributions.slice(0, 8).map((c) => (
                <li key={c.courseId} style={{ marginBottom: 4 }}>
                  Course <code style={{ fontSize: '0.8rem' }}>{c.courseId.slice(0, 8)}…</code>
                  {' — '}
                  {c.gradePoints} pts / {c.creditHours} cr
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: '0.5rem 0 0', color: muted }}>No graded enrollments counted yet.</p>
          )}
        </div>
      ) : (
        <p style={{ color: muted, marginBottom: '1rem' }}>Could not load GPA breakdown.</p>
      )}

      <div
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        }}
      >
        <div
          style={{
            border: `1px solid ${border}`,
            borderRadius: 8,
            padding: '0.85rem',
            background: '#fff',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '0.95rem', color: primary }}>Progression holds</h3>
          {progressionHolds.length === 0 ? (
            <p style={{ color: muted, fontSize: '0.85rem', marginTop: '0.5rem' }}>None active.</p>
          ) : (
            <ul
              style={{
                paddingLeft: '1rem',
                margin: '0.5rem 0 0',
                fontSize: '0.85rem',
                color: '#334155',
              }}
            >
              {progressionHolds.slice(0, 6).map((h) => (
                <li key={h.id} style={{ marginBottom: 6 }}>
                  <strong>{h.type}</strong>
                  {h.reason ? <> — {h.reason}</> : null}
                  <span style={{ color: muted }}>
                    {' '}
                    ({new Date(h.createdAt).toLocaleDateString()})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div
          style={{
            border: `1px solid ${border}`,
            borderRadius: 8,
            padding: '0.85rem',
            background: '#fff',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '0.95rem', color: primary }}>Recent decisions</h3>
          {decisions.length === 0 ? (
            <p style={{ color: muted, fontSize: '0.85rem', marginTop: '0.5rem' }}>None recorded.</p>
          ) : (
            <ul
              style={{
                paddingLeft: '1rem',
                margin: '0.5rem 0 0',
                fontSize: '0.85rem',
                color: '#334155',
              }}
            >
              {decisions.slice(0, 8).map((d) => (
                <li key={d.id} style={{ marginBottom: 6 }}>
                  <strong>{d.kind}</strong>
                  <span style={{ color: muted }}>
                    {' '}
                    — {new Date(d.createdAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div
          style={{
            border: `1px solid ${border}`,
            borderRadius: 8,
            padding: '0.85rem',
            background: '#fff',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '0.95rem', color: primary }}>Carryover links</h3>
          {carryovers.length === 0 ? (
            <p style={{ color: muted, fontSize: '0.85rem', marginTop: '0.5rem' }}>None.</p>
          ) : (
            <ul
              style={{
                paddingLeft: '1rem',
                margin: '0.5rem 0 0',
                fontSize: '0.82rem',
                color: '#334155',
              }}
            >
              {carryovers.map((c) => (
                <li key={c.id} style={{ marginBottom: 8 }}>
                  {c.original.courseCode} ({c.original.semesterName ?? '?'}) → {c.repeat.courseCode}{' '}
                  ({c.repeat.semesterName ?? '?'})
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
