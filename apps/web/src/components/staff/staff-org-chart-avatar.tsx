export function StaffOrgChartAvatar({
  name,
  photoUrl,
  size = 24,
}: {
  name: string;
  photoUrl?: string | null;
  size?: number;
}) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt=""
        width={size}
        height={size}
        style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#e2e8f0',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.38,
        fontWeight: 600,
        color: '#64748b',
        flexShrink: 0,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
