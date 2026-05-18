'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { runAdminAiAction, type AdminAiState } from './actions';

const initial: AdminAiState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: '0.5rem 0.95rem',
        borderRadius: 8,
        border: '1px solid #cbd5e1',
        background: '#fff',
        fontWeight: 600,
        fontSize: '0.88rem',
        cursor: pending ? 'wait' : 'pointer',
      }}
    >
      {pending ? 'Running…' : label}
    </button>
  );
}

function ActionForm({
  action,
  label,
  entityId,
  entities,
  showEntity,
}: {
  action: string;
  label: string;
  entityId?: string;
  entities: { id: string; name: string }[];
  showEntity?: boolean;
}) {
  const [state, formAction] = useFormState(runAdminAiAction, initial);

  return (
    <form
      action={formAction}
      style={{
        display: 'grid',
        gap: '0.65rem',
        padding: '1rem',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        background: '#fafafa',
      }}
    >
      <input type="hidden" name="action" value={action} />
      {showEntity ? (
        <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
          Entity
          <select
            name="entityId"
            defaultValue={entityId ?? ''}
            required
            style={{
              display: 'block',
              marginTop: 4,
              width: '100%',
              padding: '0.4rem',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
            }}
          >
            <option value="" disabled>
              Choose entity…
            </option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <SubmitButton label={label} />
      {state.error ? (
        <p style={{ margin: 0, color: '#b91c1c', fontSize: '0.85rem' }}>{state.error}</p>
      ) : null}
      {state.result ? (
        <pre
          style={{
            margin: 0,
            fontSize: '0.75rem',
            maxHeight: 280,
            overflow: 'auto',
            background: '#0f172a',
            color: '#e2e8f0',
            padding: '0.75rem',
            borderRadius: 8,
          }}
        >
          {JSON.stringify(state.result, null, 2)}
        </pre>
      ) : null}
    </form>
  );
}

export function AdminAiPanel({
  entities,
}: {
  entities: { id: string; name: string; code: string }[];
}) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '1rem',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      }}
    >
      <ActionForm action="narrative-institution" label="VC weekly narrative" entities={entities} />
      <ActionForm
        action="narrative-entity"
        label="Principal narrative"
        entities={entities}
        showEntity
      />
      <ActionForm action="billing-anomaly" label="Billing anomaly scan" entities={entities} />
      <ActionForm
        action="dropout-institution"
        label="Dropout risk (consolidated)"
        entities={entities}
      />
      <ActionForm
        action="dropout-entity"
        label="Dropout risk (entity)"
        entities={entities}
        showEntity
      />
    </div>
  );
}
