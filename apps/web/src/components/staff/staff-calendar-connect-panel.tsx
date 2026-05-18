'use client';

export function StaffCalendarConnectPanel({
  googleEnabled,
  microsoftEnabled,
}: {
  googleEnabled: boolean;
  microsoftEnabled: boolean;
}) {
  return (
    <section
      style={{
        marginTop: '1.25rem',
        padding: '1.25rem 1.5rem',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
      }}
    >
      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', color: '#0f1729' }}>Calendar sync</h2>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: '#64748b' }}>
        Connect your calendar so approved leave is pushed automatically (OAuth). Deep links and iCal
        export remain available without connecting.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {googleEnabled ? (
          <a href="/staff/calendar-connect/google" style={linkStyle}>
            Connect Google Calendar
          </a>
        ) : (
          <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Google OAuth not configured</span>
        )}
        {microsoftEnabled ? (
          <a href="/staff/calendar-connect/microsoft" style={linkStyle}>
            Connect Outlook
          </a>
        ) : (
          <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
            Microsoft OAuth not configured
          </span>
        )}
      </div>
    </section>
  );
}

const linkStyle = {
  padding: '0.45rem 0.75rem',
  borderRadius: 8,
  background: '#eff6ff',
  color: '#2563eb',
  fontSize: '0.85rem',
  fontWeight: 600,
  textDecoration: 'none',
} as const;
