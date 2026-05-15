'use client';

import { motion } from 'framer-motion';

export type StatusChangeRow = {
  id: string;
  fromStatus: string;
  toStatus: string;
  reason: string;
  billingImplication: string;
  recordedAt: string;
  actorRole: string;
};

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function billingLabel(code: string): string {
  switch (code) {
    case 'GAIN':
      return 'GAIN';
    case 'LOSS':
      return 'LOSS';
    case 'RETROACTIVE_GAIN':
      return 'RETROACTIVE_GAIN';
    default:
      return 'NONE';
  }
}

export function StudentStatusTimeline({ entries }: { entries: StatusChangeRow[] }) {
  if (entries.length === 0) {
    return (
      <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0.5rem 0 0' }}>
        No recorded enrollment status changes yet.
      </p>
    );
  }
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          left: 10,
          top: 8,
          bottom: 8,
          width: 2,
          background: '#e2e8f0',
        }}
        aria-hidden
      />
      {entries.map((e, i) => (
        <motion.li
          key={e.id}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.04, duration: 0.22 }}
          style={{
            position: 'relative',
            paddingLeft: '2.25rem',
            paddingBottom: '1.1rem',
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: 4,
              top: 6,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#fff',
              border: '2px solid #1e3a5f',
            }}
          />
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>{formatWhen(e.recordedAt)}</p>
          <p style={{ margin: '0.25rem 0 0', fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
            <span style={{ fontFamily: 'ui-monospace, monospace' }}>{e.fromStatus}</span>
            <span style={{ margin: '0 0.35rem', color: '#94a3b8' }}>→</span>
            <span style={{ fontFamily: 'ui-monospace, monospace' }}>{e.toStatus}</span>
            <span
              style={{
                marginLeft: '0.5rem',
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#475569',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              {billingLabel(e.billingImplication)}
            </span>
          </p>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: '#334155' }}>{e.reason}</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
            Changed by role: <strong>{e.actorRole}</strong>
          </p>
        </motion.li>
      ))}
    </ol>
  );
}
