import { STUDENT_PORTAL } from './student-portal-styles';

export function StudentPortalPageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header style={{ marginBottom: '1.25rem' }}>
      <h1 style={{ margin: 0, fontSize: '1.75rem', color: STUDENT_PORTAL.text }}>{title}</h1>
      {description ? (
        <p style={{ color: STUDENT_PORTAL.muted, marginTop: '0.35rem', maxWidth: 560 }}>
          {description}
        </p>
      ) : null}
    </header>
  );
}
