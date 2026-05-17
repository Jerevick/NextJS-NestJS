'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type VideoChapterRaw = {
  title?: unknown;
  timeSeconds?: unknown;
  seconds?: unknown;
  at?: unknown;
  start?: unknown;
};

type LessonVideoContent = {
  hlsUrl?: string;
  url?: string;
  playbackUrl?: string;
  src?: string;
  chapters?: VideoChapterRaw[];
};

export type ParsedVideoChapter = { title: string; seconds: number };

function resolveVideoUrl(content: unknown): string | null {
  if (!content || typeof content !== 'object') {
    return null;
  }
  const c = content as LessonVideoContent;
  const candidate = c.hlsUrl ?? c.playbackUrl ?? c.url ?? c.src;
  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : null;
}

export function chaptersFromLessonContent(content: unknown): ParsedVideoChapter[] {
  if (!content || typeof content !== 'object') {
    return [];
  }
  const raw = (content as LessonVideoContent).chapters;
  if (!Array.isArray(raw)) {
    return [];
  }
  const list: ParsedVideoChapter[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const secs =
      typeof row.timeSeconds === 'number'
        ? row.timeSeconds
        : typeof row.seconds === 'number'
          ? row.seconds
          : typeof row.at === 'number'
            ? row.at
            : typeof row.start === 'number'
              ? row.start
              : null;
    if (!title || secs == null || Number.isNaN(secs) || secs < 0) continue;
    list.push({ title, seconds: secs });
  }
  return [...list].sort((a, b) => a.seconds - b.seconds);
}

function notesStorageKey(
  courseInstanceId: string | null | undefined,
  lessonId: string | null | undefined,
) {
  return `unicore:lms-video-notes:${courseInstanceId ?? '_'}:${lessonId ?? '_'}`;
}

const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

function formatClock(seconds: number) {
  const t = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(t / 60);
  const ss = String(t % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function HlsVideoPlayer({
  content,
  title,
  courseInstanceId,
  lessonId,
}: {
  content: unknown;
  title: string;
  /** Optional — enables synced local notes UX. */
  courseInstanceId?: string | null;
  lessonId?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rate, setRate] = useState<number>(1);
  const notesKey =
    courseInstanceId && lessonId ? notesStorageKey(courseInstanceId, lessonId) : null;
  const [notes, setNotes] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const src = resolveVideoUrl(content);
  const chapters = useMemo(() => chaptersFromLessonContent(content), [content]);

  useEffect(() => {
    const el = videoRef.current;
    if (el) {
      el.playbackRate = rate;
    }
  }, [rate]);

  useEffect(() => {
    if (!notesKey || typeof window === 'undefined') {
      setNotes('');
      return;
    }
    try {
      setNotes(window.localStorage.getItem(notesKey) ?? '');
    } catch {
      setNotes('');
    }
  }, [notesKey]);

  const persistNotes = useCallback(() => {
    if (!notesKey || typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(notesKey, notes);
    } catch {
      /* quota / privacy mode */
    }
  }, [notes, notesKey]);

  const seekChapter = useCallback((seconds: number) => {
    const el = videoRef.current;
    if (el && Number.isFinite(seconds)) {
      el.currentTime = seconds;
      void el.play().catch(() => {
        /* user gesture policies */
      });
    }
  }, []);

  useEffect(() => {
    if (!src) {
      return;
    }
    const streamUrl: string = src;
    const el = videoRef.current;
    if (!el) {
      return;
    }
    const media: HTMLVideoElement = el;

    let destroyed = false;
    let hlsInstance: { destroy: () => void } | null = null;

    async function attach() {
      setError(null);
      const isHls = streamUrl.includes('.m3u8');
      if (isHls && media.canPlayType('application/vnd.apple.mpegurl')) {
        media.src = streamUrl;
        return;
      }
      if (isHls) {
        try {
          const Hls = (await import('hls.js')).default;
          if (Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true });
            hls.loadSource(streamUrl);
            hls.attachMedia(media);
            hls.on(Hls.Events.ERROR, () => {
              if (!destroyed) {
                setError('Could not load HLS stream.');
              }
            });
            hlsInstance = hls;
            return;
          }
        } catch {
          setError('HLS.js failed to load.');
          return;
        }
      }
      media.src = streamUrl;
    }

    void attach();

    return () => {
      destroyed = true;
      hlsInstance?.destroy();
    };
  }, [src]);

  if (!src) {
    return (
      <p style={{ marginTop: '1.5rem', color: '#64748b' }}>
        No video URL in lesson content. Set <code>hlsUrl</code> or <code>url</code> in the lesson
        JSON.
      </p>
    );
  }

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          alignItems: 'center',
          marginBottom: 8,
          fontSize: '0.85rem',
          color: '#475569',
        }}
      >
        <span style={{ fontWeight: 600 }}>Playback speed</span>
        <select
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          style={{ padding: '0.25rem 0.35rem', borderRadius: 6, border: '1px solid #cbd5e1' }}
          aria-label="Playback speed"
        >
          {RATES.map((r) => (
            <option key={r} value={r}>
              {r}x
            </option>
          ))}
        </select>
      </div>

      {chapters.length > 0 ? (
        <div style={{ marginBottom: 10 }}>
          <p
            style={{
              margin: '0 0 6px',
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#64748b',
              textTransform: 'uppercase',
            }}
          >
            Chapters
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {chapters.map((c) => (
              <button
                key={`${c.seconds}-${c.title}`}
                type="button"
                onClick={() => seekChapter(c.seconds)}
                style={{
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 999,
                  fontSize: '0.78rem',
                  border: '1px solid rgba(37,99,235,0.35)',
                  background: 'rgba(37,99,235,0.08)',
                  color: '#1d4ed8',
                }}
              >
                {formatClock(c.seconds)} · {c.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <video
        ref={videoRef}
        controls
        playsInline
        title={title}
        style={{
          width: '100%',
          maxHeight: 480,
          borderRadius: 12,
          background: '#0f172a',
        }}
      />
      {notesKey ? (
        <details
          open={notesOpen}
          onToggle={(e) => setNotesOpen((e.target as HTMLDetailsElement).open)}
          style={{ marginTop: 14 }}
        >
          <summary
            style={{ cursor: 'pointer', fontSize: '0.85rem', fontWeight: 650, color: '#334155' }}
          >
            My notes (saved on your device)
          </summary>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={persistNotes}
            placeholder="Jot timestamps, glossary, or AHAs — stays in this browser only until Phase 13 sync."
            rows={5}
            style={{
              marginTop: 8,
              width: '100%',
              resize: 'vertical',
              fontFamily: `'Inter', ui-sans-serif, system-ui, sans-serif`,
              fontSize: '0.9rem',
              lineHeight: 1.5,
              padding: '0.65rem 0.75rem',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              boxSizing: 'border-box',
            }}
          />
        </details>
      ) : (
        <p style={{ marginTop: 12, fontSize: '0.78rem', color: '#94a3b8' }}>
          Notes are available once you open this lesson on a routed URL (lesson id scoped).
        </p>
      )}
      {error ? (
        <p role="alert" style={{ color: '#b91c1c', fontSize: '0.85rem', marginTop: 8 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
