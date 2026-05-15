/** Read-only notice when the student is not in ACTIVE enrollment (UNICORE .cursorrules LAW 5). */
import Link from 'next/link';

export function InactiveStudentBanner({
  enrollmentStatus,
  campusLabel,
  studentId,
}: {
  enrollmentStatus: string;
  campusLabel?: string;
  studentId?: string;
}) {
  if (enrollmentStatus === 'ACTIVE') {
    return null;
  }
  const reactivationHref = studentId
    ? `/students/reactivation?studentId=${encodeURIComponent(studentId)}`
    : '/students/reactivation';
  return (
    <aside
      style={{
        marginBottom: '1.25rem',
        padding: '1rem 1.1rem',
        borderRadius: 8,
        border: '1px solid #fbbf24',
        background: 'linear-gradient(90deg, #fffbeb 0%, #fef3c7 100%)',
        color: '#78350f',
      }}
      role="status"
      aria-live="polite"
    >
      <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>
        This student is not ACTIVE — status <span style={{ fontFamily: 'ui-monospace, monospace' }}>{enrollmentStatus}</span>
        {campusLabel ? ` · ${campusLabel}` : null}
      </p>
      <p style={{ margin: '0.5rem 0 0', fontSize: '0.88rem', lineHeight: 1.45 }}>
        Read-only mode: the API blocks posting academic, financial, LMS, and admin records for non-ACTIVE students.
        Use registrar workflows for reactivation, backfill, or permanent deletion where applicable.
      </p>
      <p style={{ margin: '0.65rem 0 0', fontSize: '0.88rem' }}>
        <Link href={reactivationHref} style={{ color: '#1d4ed8', fontWeight: 600, textDecoration: 'underline' }}>
          Reactivation requests
        </Link>
        {' · '}
        <Link href="/billing/disputes" style={{ color: '#1d4ed8', fontWeight: 600, textDecoration: 'underline' }}>
          Billing disputes
        </Link>
      </p>
    </aside>
  );
}
