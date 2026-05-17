type Props = {
  primary: string;
  accent: string;
  muted: string;
  gpa: number | null;
  standing: string;
  creditsEarned: number;
};

/**
 * Lightweight, policy-free panel for staff (not powered by LLM). Surfaces heuristic flags from aggregates.
 */
export function StudentAcademicInsightsPanel(props: Props) {
  const { primary, accent, muted, gpa, standing, creditsEarned } = props;
  const lines: string[] = [];

  if (gpa !== null && gpa < 2.0) {
    lines.push(
      'CGPA sits below the common 2.0 maintenance threshold — recommend academic advising.',
    );
  }
  if (gpa !== null && gpa >= 3.7) {
    lines.push('CGPA trajectory looks strong versus typical honors-eligible ranges.');
  }
  if (/PROB|SUSP|risk/i.test(standing)) {
    lines.push(
      `Standing “${standing}” usually implies extra checkpoints before progression or enrollment changes.`,
    );
  }
  if (creditsEarned === 0) {
    lines.push(
      'Zero earned credits recorded — validate enrollments vs. graded history if unexpected.',
    );
  }
  if (lines.length === 0) {
    lines.push(
      'No automatic risk flags surfaced from GPA, standing, and earned credits alone. Combine with transcripts and registrar notes.',
    );
  }

  return (
    <section
      style={{
        marginBottom: '2rem',
        padding: '1rem 1.1rem',
        border: `1px solid ${accent}`,
        borderRadius: 10,
        background: '#fffbeb',
      }}
    >
      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1rem', color: primary, fontWeight: 700 }}>
        Insights (deterministic preview)
      </h2>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: muted }}>
        Heuristics derived from aggregates only — optional AI overlays can deepen this panel later.
      </p>
      <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.92rem', color: '#92400e' }}>
        {lines.map((t, i) => (
          <li key={i} style={{ marginBottom: '0.35rem' }}>
            {t}
          </li>
        ))}
      </ul>
    </section>
  );
}
