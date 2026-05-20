import { GUARDIAN_PORTAL } from './guardian-portal-styles';

export function GuardianDashboardSummary({
  totalStudents,
  onTrackCount,
  outstandingBalanceCount,
  inactiveCount,
}: {
  totalStudents: number;
  onTrackCount: number;
  outstandingBalanceCount: number;
  inactiveCount: number;
}) {
  const items = [
    { label: 'Linked students', value: totalStudents, color: GUARDIAN_PORTAL.text },
    { label: 'On track', value: onTrackCount, color: '#15803d' },
    { label: 'Balance due', value: outstandingBalanceCount, color: GUARDIAN_PORTAL.alert },
    { label: 'Inactive', value: inactiveCount, color: '#b91c1c' },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '0.75rem',
        marginTop: '1.25rem',
      }}
    >
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            padding: '0.85rem 1rem',
            background: GUARDIAN_PORTAL.card,
            borderRadius: 10,
            border: `1px solid ${GUARDIAN_PORTAL.border}`,
          }}
        >
          <div style={{ fontSize: '0.75rem', color: GUARDIAN_PORTAL.muted }}>{item.label}</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: item.color, marginTop: 4 }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
