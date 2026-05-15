'use client';

import { useActionState, type CSSProperties } from 'react';
import { provisionInstitutionAction } from '@/app/actions/platform';

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.65rem',
  borderRadius: 6,
  border: '1px solid #334155',
  background: '#0f172a',
  color: '#f1f5f9',
  fontSize: '0.9rem',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  color: '#94a3b8',
  marginBottom: 4,
};

export function ProvisionInstitutionForm({ bearerConfigured }: { bearerConfigured: boolean }) {
  const [state, action, pending] = useActionState(provisionInstitutionAction, null);

  if (!bearerConfigured) {
    return (
      <p style={{ color: '#fbbf24', fontSize: '0.9rem' }}>
        Set <code style={{ color: '#e2e8f0' }}>ADMIN_API_BEARER</code> in the admin app environment to
        provision institutions against the live API.
      </p>
    );
  }

  return (
    <form action={action} style={{ display: 'grid', gap: '1rem', maxWidth: 480 }}>
      <div>
        <label htmlFor="slug" style={labelStyle}>
          Slug
        </label>
        <input id="slug" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" style={inputStyle} />
      </div>
      <div>
        <label htmlFor="name" style={labelStyle}>
          Institution name
        </label>
        <input id="name" name="name" required minLength={2} style={inputStyle} />
      </div>
      <div>
        <label htmlFor="domain" style={labelStyle}>
          Domain (optional)
        </label>
        <input id="domain" name="domain" type="text" style={inputStyle} placeholder="university.edu" />
      </div>
      <div>
        <label htmlFor="plan" style={labelStyle}>
          Plan
        </label>
        <select id="plan" name="plan" defaultValue="STARTER" style={inputStyle}>
          <option value="STARTER">STARTER</option>
          <option value="GROWTH">GROWTH</option>
          <option value="ENTERPRISE">ENTERPRISE</option>
        </select>
      </div>
      <div>
        <label htmlFor="adminEmail" style={labelStyle}>
          Admin email
        </label>
        <input id="adminEmail" name="adminEmail" type="email" required style={inputStyle} />
      </div>
      <div>
        <label htmlFor="adminPassword" style={labelStyle}>
          Admin password
        </label>
        <input
          id="adminPassword"
          name="adminPassword"
          type="password"
          required
          minLength={8}
          style={inputStyle}
        />
      </div>
      {state?.error ? (
        <p style={{ color: '#f87171', fontSize: '0.85rem', margin: 0 }}>{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        style={{
          padding: '0.6rem 1rem',
          borderRadius: 6,
          border: 'none',
          background: pending ? '#334155' : '#2563eb',
          color: '#fff',
          fontWeight: 600,
          cursor: pending ? 'wait' : 'pointer',
        }}
      >
        {pending ? 'Provisioning…' : 'Create institution'}
      </button>
    </form>
  );
}
