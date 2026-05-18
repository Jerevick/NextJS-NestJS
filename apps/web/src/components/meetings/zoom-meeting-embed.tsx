'use client';

import { useEffect, useRef, useState } from 'react';

type ZoomSdkPayload = {
  sdkKey: string;
  signature: string;
  meetingNumber: string;
  joinUrl: string;
};

/** In-browser Zoom Meeting SDK join (falls back to external link). */
export function ZoomMeetingEmbed({
  meetingId,
  meetingLink,
  fetchSdk,
}: {
  meetingId: string;
  meetingLink: string;
  fetchSdk: (meetingId: string) => Promise<ZoomSdkPayload | { error: string }>;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'joined' | 'fallback'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'loading') return;
    let cancelled = false;
    void (async () => {
      try {
        const creds = await fetchSdk(meetingId);
        if ('error' in creds) {
          if (!cancelled) {
            setError(creds.error);
            setStatus('fallback');
          }
          return;
        }
        const { ZoomMtg } = await import('@zoom/meetingsdk');
        ZoomMtg.setZoomJSLib('https://source.zoom.us/3.10.0/lib', '/av');
        await ZoomMtg.preLoadWasm();
        await ZoomMtg.prepareWebSDK();
        if (cancelled || !rootRef.current) return;
        await ZoomMtg.init({
          leaveUrl: window.location.href,
          patchJsMedia: true,
          success: () => {
            void ZoomMtg.join({
              sdkKey: creds.sdkKey,
              signature: creds.signature,
              meetingNumber: creds.meetingNumber,
              userName: 'Guest',
              success: () => {
                if (!cancelled) setStatus('joined');
              },
              error: (e: unknown) => {
                if (!cancelled) {
                  setError(String(e));
                  setStatus('fallback');
                }
              },
            });
          },
          error: (e: unknown) => {
            if (!cancelled) {
              setError(String(e));
              setStatus('fallback');
            }
          },
        });
      } catch (e) {
        if (!cancelled) {
          setError(String(e));
          setStatus('fallback');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meetingId, fetchSdk, status]);

  return (
    <section style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setStatus('loading')}
          disabled={status === 'loading' || status === 'joined'}
          style={{
            padding: '0.4rem 0.75rem',
            borderRadius: 8,
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          {status === 'joined'
            ? 'Zoom joined'
            : status === 'loading'
              ? 'Connecting…'
              : 'Join in browser (Zoom SDK)'}
        </button>
        <a
          href={meetingLink}
          target="_blank"
          rel="noreferrer"
          style={{ alignSelf: 'center', color: '#2563eb' }}
        >
          Open in Zoom app
        </a>
      </div>
      {error && status === 'fallback' ? (
        <p style={{ fontSize: '0.85rem', color: '#b45309' }}>
          SDK unavailable ({error}). Use the external link above.
        </p>
      ) : null}
      <div
        ref={rootRef}
        id={`zoom-root-${meetingId}`}
        style={{
          minHeight: status === 'joined' ? 480 : 0,
          width: '100%',
          background: '#0f172a',
          borderRadius: 12,
        }}
      />
    </section>
  );
}
