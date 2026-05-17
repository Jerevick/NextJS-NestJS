type ProgressPayload = {
  studentId: string;
  courseInstanceId: string;
  progressPercent: number;
  completedLessons: string[];
  completedModules: string[];
};

export function CourseProgressCard({
  progress,
  lessonCount,
}: {
  progress: ProgressPayload | null;
  lessonCount: number;
}) {
  const percent = progress?.progressPercent ?? 0;
  const completed = progress?.completedLessons.length ?? 0;

  return (
    <section
      style={{
        marginTop: '1.25rem',
        padding: '1rem 1.15rem',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
      }}
    >
      <h3 style={{ margin: '0 0 0.65rem', fontSize: '1rem', color: '#0f1729' }}>Your progress</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: `conic-gradient(#2563eb ${percent * 3.6}deg, #e2e8f0 0)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#1e3a5f',
            }}
          >
            {percent}%
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
          {completed} of {lessonCount} lessons completed
          {progress && progress.completedModules.length > 0
            ? ` · ${progress.completedModules.length} module(s) finished`
            : null}
        </p>
      </div>
    </section>
  );
}
