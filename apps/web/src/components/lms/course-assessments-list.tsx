import Link from 'next/link';

export type LmsAssessmentRow = {
  id: string;
  title: string;
  type: string;
  dueDate: string | null;
  totalPoints: number;
  settings?: Record<string, unknown>;
};

export function CourseAssessmentsList({
  courseInstanceId,
  assessments,
  studentId,
}: {
  courseInstanceId: string;
  assessments: LmsAssessmentRow[];
  studentId?: string;
}) {
  const qs = studentId ? `?studentId=${encodeURIComponent(studentId)}` : '';
  if (assessments.length === 0) {
    return (
      <p style={{ marginTop: '1rem', color: '#94a3b8', fontSize: '0.9rem' }}>
        No assessments published yet.
      </p>
    );
  }

  return (
    <ul style={{ margin: '0.75rem 0 0', padding: 0, listStyle: 'none' }}>
      {assessments.map((a) => (
        <li
          key={a.id}
          style={{
            padding: '0.65rem 0',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <div>
            <strong style={{ color: '#0f1729' }}>{a.title}</strong>
            <span style={{ color: '#64748b', fontSize: '0.85rem', marginLeft: 8 }}>{a.type}</span>
            {a.dueDate ? (
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Due {new Date(a.dueDate).toLocaleString()}
              </p>
            ) : null}
          </div>
          <Link
            href={`/courses/${courseInstanceId}/assessments/${a.id}${qs}`}
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#2563eb',
              textDecoration: 'none',
            }}
          >
            Open
          </Link>
        </li>
      ))}
    </ul>
  );
}
