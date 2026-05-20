'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { saveIntegrations } from '@/app/settings/integrations/actions';

type Props = {
  initial: { zoomEnabled: boolean; whatsappEnabled: boolean; calendarProvider: string };
  entityId?: string;
  readOnly?: boolean;
};

export function IntegrationsEditor({ initial, entityId, readOnly }: Props) {
  const router = useRouter();
  const [zoomEnabled, setZoomEnabled] = useState(initial.zoomEnabled);
  const [whatsappEnabled, setWhatsappEnabled] = useState(initial.whatsappEnabled);
  const [calendarProvider, setCalendarProvider] = useState(initial.calendarProvider);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    start(async () => {
      setMsg(null);
      const result = await saveIntegrations(
        {
          'integrations.zoom': { enabled: zoomEnabled },
          'integrations.whatsapp': { enabled: whatsappEnabled },
          'integrations.calendar': { provider: calendarProvider },
        },
        entityId,
      );
      setMsg(result.error ?? 'Saved');
      if (!result.error) router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: '1rem', maxWidth: 420 }}>
      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={zoomEnabled}
          onChange={(e) => setZoomEnabled(e.target.checked)}
          disabled={readOnly || pending}
        />
        Zoom enabled
      </label>
      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={whatsappEnabled}
          onChange={(e) => setWhatsappEnabled(e.target.checked)}
          disabled={readOnly || pending}
        />
        WhatsApp enabled
      </label>
      <label style={{ display: 'grid', gap: '0.35rem' }}>
        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Calendar provider</span>
        <select
          value={calendarProvider}
          onChange={(e) => setCalendarProvider(e.target.value)}
          disabled={readOnly || pending}
          style={{ padding: '0.5rem 0.65rem', borderRadius: 8, border: '1px solid #cbd5e1' }}
        >
          <option value="none">None</option>
          <option value="google">Google Calendar</option>
          <option value="outlook">Outlook</option>
        </select>
      </label>
      {!readOnly && (
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: '0.6rem 1rem',
            borderRadius: 8,
            border: 'none',
            background: '#1e3a5f',
            color: '#fff',
            fontWeight: 600,
            width: 'fit-content',
          }}
        >
          Save integrations
        </button>
      )}
      {msg && (
        <p style={{ fontSize: '0.88rem', color: msg.includes('failed') ? '#b91c1c' : '#15803d' }}>
          {msg}
        </p>
      )}
    </form>
  );
}
