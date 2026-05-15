const TYPE_STYLES: Record<string, { bg: string; fg: string }> = {
  MAIN_CAMPUS: { bg: '#dbeafe', fg: '#1e40af' },
  SCHOOL: { bg: '#ede9fe', fg: '#5b21b6' },
  EXTRAMURAL: { bg: '#fef3c7', fg: '#92400e' },
  DISTANCE_LEARNING: { bg: '#cffafe', fg: '#0e7490' },
  SATELLITE_CAMPUS: { bg: '#dcfce7', fg: '#166534' },
  PROFESSIONAL_SCHOOL: { bg: '#fce7f3', fg: '#9d174d' },
  SUMMER_SCHOOL: { bg: '#ffedd5', fg: '#c2410c' },
  RESEARCH_INSTITUTE: { bg: '#f1f5f9', fg: '#334155' },
  CONSTITUENT_COLLEGE: { bg: '#e0e7ff', fg: '#3730a3' },
  AFFILIATE: { bg: '#f3f4f6', fg: '#374151' },
};

export function EntityTypeBadge({ type }: { type: string }) {
  const s = TYPE_STYLES[type] ?? { bg: '#f3f4f6', fg: '#374151' };
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: '0.7rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        textTransform: 'uppercase' as const,
        padding: '0.2rem 0.5rem',
        borderRadius: 6,
        background: s.bg,
        color: s.fg,
      }}
    >
      {type.replace(/_/g, ' ')}
    </span>
  );
}
