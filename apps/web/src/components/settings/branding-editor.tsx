'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';

import {
  saveBranding,
  uploadBrandingLogo,
  type BrandingInput,
} from '@/app/settings/branding/actions';

type Props = {
  initial: BrandingInput & { institutionName: string };
  entityId?: string;
  readOnly?: boolean;
};

const fieldStyle = { padding: '0.5rem 0.65rem', borderRadius: 8, border: '1px solid #cbd5e1' };

export function BrandingEditor({ initial, entityId, readOnly }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? '');
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor ?? '#1e3a5f');
  const [customDomain, setCustomDomain] = useState(initial.customDomain ?? '');
  const [msg, setMsg] = useState<{ error?: string; ok?: boolean } | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    start(async () => {
      setMsg(null);
      const result = await saveBranding({
        logoUrl: logoUrl.trim() || undefined,
        primaryColor: primaryColor.trim() || undefined,
        customDomain: customDomain.trim() || undefined,
        entityId,
      });
      setMsg(result.error ? { error: result.error } : { ok: true });
      if (result.ok) router.refresh();
    });
  }

  function onUploadLogo() {
    if (readOnly || !fileRef.current?.files?.[0]) return;
    const fd = new FormData();
    fd.append('file', fileRef.current.files[0]);
    start(async () => {
      setMsg(null);
      const result = await uploadBrandingLogo(fd, entityId);
      if (result.error) {
        setMsg({ error: result.error });
        return;
      }
      if (result.logoUrl) setLogoUrl(result.logoUrl);
      setMsg({ ok: true });
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: '1.25rem', maxWidth: 520 }}>
      <fieldset
        style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem', margin: 0 }}
      >
        <legend style={{ padding: '0 0.35rem', fontSize: '0.88rem', color: '#64748b' }}>
          Logo
        </legend>
        {!readOnly && (
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              flexWrap: 'wrap',
              alignItems: 'center',
              marginBottom: '0.75rem',
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              disabled={pending}
            />
            <button
              type="button"
              disabled={pending}
              onClick={onUploadLogo}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: 8,
                border: '1px solid #1e3a5f',
                background: '#fff',
                color: '#1e3a5f',
                cursor: 'pointer',
              }}
            >
              Upload logo
            </button>
          </div>
        )}
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Or paste logo URL</span>
          <input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            disabled={readOnly || pending}
            placeholder="https://…"
            style={fieldStyle}
          />
        </label>
      </fieldset>

      <label style={{ display: 'grid', gap: '0.35rem' }}>
        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Primary colour</span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="color"
            value={primaryColor.startsWith('#') ? primaryColor : '#1e3a5f'}
            onChange={(e) => setPrimaryColor(e.target.value)}
            disabled={readOnly || pending}
          />
          <input
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            disabled={readOnly || pending}
            style={{ ...fieldStyle, flex: 1 }}
          />
        </div>
      </label>

      <label style={{ display: 'grid', gap: '0.35rem' }}>
        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Custom domain</span>
        <input
          value={customDomain}
          onChange={(e) => setCustomDomain(e.target.value)}
          disabled={readOnly || pending}
          placeholder="portal.example.edu"
          style={fieldStyle}
        />
      </label>

      <div style={{ padding: '1rem', borderRadius: 8, background: primaryColor, color: '#fff' }}>
        {logoUrl ? (
          <img src={logoUrl} alt="" style={{ maxHeight: 48, marginBottom: 8, display: 'block' }} />
        ) : null}
        <div style={{ fontWeight: 600 }}>{initial.institutionName}</div>
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', opacity: 0.9 }}>
          Email / portal preview
        </p>
      </div>

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
            cursor: pending ? 'wait' : 'pointer',
            width: 'fit-content',
          }}
        >
          {pending ? 'Saving…' : 'Save branding'}
        </button>
      )}
      {msg?.error && <p style={{ color: '#b91c1c', fontSize: '0.88rem' }}>{msg.error}</p>}
      {msg?.ok && <p style={{ color: '#15803d', fontSize: '0.88rem' }}>Saved.</p>}
    </form>
  );
}
