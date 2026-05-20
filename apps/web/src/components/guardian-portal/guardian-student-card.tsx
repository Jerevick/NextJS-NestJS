import Link from 'next/link';
import { GUARDIAN_PORTAL } from './guardian-portal-styles';

type Visibility = { academic: boolean; finance: boolean; attendance: boolean };

export type GuardianStudentCardProps = {
  student: {
    studentId: string;
    studentNumber: string;
    displayName: string;
    enrollmentStatus: string;
    program: { code: string; name: string };
    entity: { code: string; name: string };
    cgpa: number | null;
    balance: number | null;
    alerts: { outstandingBalance: boolean; inactive: boolean };
  };
  visibility: Visibility;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

export function GuardianStudentCard({ student: s, visibility }: GuardianStudentCardProps) {
  const hasAlert = s.alerts.outstandingBalance || s.alerts.inactive;

  return (
    <article
      style={{
        padding: '1.15rem 1.25rem',
        background: GUARDIAN_PORTAL.card,
        borderRadius: 12,
        border: `1px solid ${hasAlert ? '#fdba74' : GUARDIAN_PORTAL.border}`,
        boxShadow: hasAlert ? '0 0 0 1px rgba(251,191,36,0.25)' : undefined,
      }}
    >
      <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${GUARDIAN_PORTAL.accent}, #3b82f6)`,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.95rem',
            flexShrink: 0,
          }}
          aria-hidden
        >
          {initials(s.displayName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '1.15rem' }}>{s.displayName}</div>
          <div style={{ color: GUARDIAN_PORTAL.muted, marginTop: 4, fontSize: '0.88rem' }}>
            {s.studentNumber} · {s.program.code}
          </div>
          <div style={{ color: GUARDIAN_PORTAL.muted, fontSize: '0.82rem', marginTop: 2 }}>
            {s.entity.code} · {s.enrollmentStatus}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1.25rem',
          marginTop: '0.85rem',
          paddingTop: '0.85rem',
          borderTop: `1px solid ${GUARDIAN_PORTAL.border}`,
        }}
      >
        {visibility.academic ? (
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                color: GUARDIAN_PORTAL.muted,
                textTransform: 'uppercase',
              }}
            >
              CGPA
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.35rem' }}>
              {s.cgpa != null ? s.cgpa.toFixed(2) : '—'}
            </div>
          </div>
        ) : null}
        {visibility.finance ? (
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                color: GUARDIAN_PORTAL.muted,
                textTransform: 'uppercase',
              }}
            >
              Balance
            </div>
            <div
              style={{
                fontWeight: 700,
                fontSize: '1.35rem',
                color: s.alerts.outstandingBalance ? GUARDIAN_PORTAL.alert : GUARDIAN_PORTAL.text,
              }}
            >
              {s.balance != null ? s.balance.toFixed(2) : '—'}
            </div>
          </div>
        ) : null}
      </div>

      {hasAlert ? (
        <div
          style={{
            marginTop: '0.75rem',
            padding: '0.45rem 0.65rem',
            borderRadius: 8,
            background: '#fff7ed',
            fontSize: '0.88rem',
            color: GUARDIAN_PORTAL.alert,
          }}
        >
          {s.alerts.outstandingBalance ? 'Outstanding balance' : null}
          {s.alerts.outstandingBalance && s.alerts.inactive ? ' · ' : null}
          {s.alerts.inactive ? 'Inactive enrollment' : null}
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginTop: '1rem',
        }}
      >
        {visibility.academic ? (
          <Link
            href={`/guardian/${s.studentId}/academic`}
            style={{
              padding: '0.5rem 0.9rem',
              background: GUARDIAN_PORTAL.accent,
              color: '#fff',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.88rem',
            }}
          >
            Academic
          </Link>
        ) : null}
        {visibility.finance ? (
          <Link
            href={`/guardian/${s.studentId}/finance`}
            style={{
              padding: '0.5rem 0.9rem',
              border: `2px solid ${GUARDIAN_PORTAL.accent}`,
              color: GUARDIAN_PORTAL.accent,
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.88rem',
            }}
          >
            Finance
          </Link>
        ) : null}
        {visibility.attendance ? (
          <Link
            href={`/guardian/${s.studentId}/attendance`}
            style={{
              padding: '0.5rem 0.9rem',
              color: GUARDIAN_PORTAL.accent,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.88rem',
            }}
          >
            Attendance
          </Link>
        ) : null}
      </div>
    </article>
  );
}
