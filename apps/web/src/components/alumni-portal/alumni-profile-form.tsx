'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
  initial?: {
    graduationYear?: number | null;
    currentEmployer?: string | null;
    jobTitle?: string | null;
    industry?: string | null;
    bio?: string | null;
    mentorshipAvailable?: boolean;
  };
  canRegister: boolean;
};

export function AlumniProfileForm({ initial, canRegister }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!canRegister) {
    return (
      <p style={{ color: '#64748b', fontSize: '0.92rem' }}>
        Your student record must have graduation confirmed before you can register as alumni.
        Contact your registrar if you recently graduated.
      </p>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const graduationYear = fd.get('graduationYear');
    const body = {
      graduationYear: graduationYear ? Number(graduationYear) : undefined,
      currentEmployer: String(fd.get('currentEmployer') || '').trim() || undefined,
      jobTitle: String(fd.get('jobTitle') || '').trim() || undefined,
      industry: String(fd.get('industry') || '').trim() || undefined,
      bio: String(fd.get('bio') || '').trim() || undefined,
      mentorshipAvailable: fd.get('mentorshipAvailable') === 'on',
    };

    const res = await fetch('/api/portal/alumni/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    setPending(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? `Save failed (${res.status})`);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: '0.85rem', maxWidth: 480 }}>
      <label style={{ display: 'grid', gap: 4, fontSize: '0.88rem' }}>
        Graduation year
        <input
          name="graduationYear"
          type="number"
          min={1950}
          max={2100}
          defaultValue={initial?.graduationYear ?? ''}
          style={fieldStyle}
        />
      </label>
      <label style={{ display: 'grid', gap: 4, fontSize: '0.88rem' }}>
        Current employer
        <input
          name="currentEmployer"
          defaultValue={initial?.currentEmployer ?? ''}
          style={fieldStyle}
        />
      </label>
      <label style={{ display: 'grid', gap: 4, fontSize: '0.88rem' }}>
        Job title
        <input name="jobTitle" defaultValue={initial?.jobTitle ?? ''} style={fieldStyle} />
      </label>
      <label style={{ display: 'grid', gap: 4, fontSize: '0.88rem' }}>
        Industry
        <input name="industry" defaultValue={initial?.industry ?? ''} style={fieldStyle} />
      </label>
      <label style={{ display: 'grid', gap: 4, fontSize: '0.88rem' }}>
        Bio
        <textarea
          name="bio"
          rows={3}
          defaultValue={initial?.bio ?? ''}
          style={{ ...fieldStyle, resize: 'vertical' }}
        />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem' }}>
        <input
          name="mentorshipAvailable"
          type="checkbox"
          defaultChecked={initial?.mentorshipAvailable ?? true}
        />
        Available for mentorship
      </label>
      {error ? <p style={{ color: '#b91c1c', margin: 0, fontSize: '0.88rem' }}>{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        style={{
          padding: '0.65rem 1rem',
          background: '#0d9488',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontWeight: 600,
          cursor: pending ? 'wait' : 'pointer',
        }}
      >
        {pending ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  );
}

const fieldStyle: React.CSSProperties = {
  padding: '0.5rem 0.65rem',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  fontSize: '0.95rem',
};
