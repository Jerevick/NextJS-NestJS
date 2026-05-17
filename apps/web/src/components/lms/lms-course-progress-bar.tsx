/** Thin progress bar across the course shell (Prompt 8.2). */
export function LmsCourseProgressBar({ percent }: { percent: number }) {
  const p = Math.min(100, Math.max(0, percent));
  return (
    <div
      role="progressbar"
      aria-valuenow={p}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        width: '100%',
        height: 6,
        borderRadius: 4,
        background: '#e2e8f0',
        overflow: 'hidden',
        marginBottom: '1rem',
      }}
    >
      <div
        style={{
          width: `${p}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #2563eb, #7c3aed)',
          transition: 'width 0.25s ease',
        }}
      />
    </div>
  );
}
