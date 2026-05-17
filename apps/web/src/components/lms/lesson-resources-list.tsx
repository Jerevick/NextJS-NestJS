function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) {
    return '—';
  }
  if (n < 1024) {
    return `${n} B`;
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`;
  }
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Renders LMS lesson attachments returned on course detail / **`GET /lms/lessons/:id`**. */
export function LessonResourcesList({
  resources,
}: {
  resources: Array<{
    id: string;
    title: string;
    fileKey: string;
    fileType: string;
    fileSize: number;
  }>;
}) {
  if (!resources.length) {
    return null;
  }

  return (
    <section style={{ marginTop: '1.5rem' }}>
      <h2 style={{ margin: '0 0 0.65rem', fontSize: '1rem', color: '#0f1729' }}>
        Downloads & resources
      </h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
        {resources.map((r) => {
          const isUrl = /^https?:\/\//i.test(r.fileKey.trim()) || r.fileKey.startsWith('//');
          const href = isUrl ? r.fileKey.trim() : null;
          const inner = (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontWeight: 600, color: '#1e293b' }}>{r.title}</span>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                {r.fileType} · {formatBytes(r.fileSize)}
              </span>
            </span>
          );

          return (
            <li
              key={r.id}
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                background: '#fff',
              }}
            >
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#2563eb', textDecoration: 'none', display: 'block' }}
                >
                  {inner}
                </a>
              ) : (
                <div title={r.fileKey} style={{ color: '#475569' }}>
                  {inner}
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', color: '#94a3b8' }}>
                    Storage key references an object prefix — wire a CDN or signed-URL gateway to
                    enable direct download.
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
