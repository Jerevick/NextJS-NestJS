'use client';

export type DynamicFormField = {
  id: string;
  type:
    | 'text'
    | 'textarea'
    | 'number'
    | 'date'
    | 'select'
    | 'multiselect'
    | 'checkbox'
    | 'radio'
    | 'section_header';
  label: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
};

export type DynamicFormSchema = {
  title?: string;
  fields: DynamicFormField[];
};

const fieldStyle = {
  padding: '0.45rem 0.6rem',
  borderRadius: 8,
  border: '1px solid #e2e8f0',
  width: '100%',
  boxSizing: 'border-box' as const,
};

export function DynamicForm({
  schema,
  values,
  onChange,
  disabled,
}: {
  schema: DynamicFormSchema;
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {schema.title ? (
        <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', fontWeight: 600 }}>
          {schema.title}
        </p>
      ) : null}
      {schema.fields.map((field) => {
        if (field.type === 'section_header') {
          return (
            <h4
              key={field.id}
              style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: '#334155' }}
            >
              {field.label}
            </h4>
          );
        }
        const value = values[field.id];
        const set = (v: unknown) => onChange({ ...values, [field.id]: v });
        return (
          <label
            key={field.id}
            style={{ display: 'grid', gap: 4, fontSize: '0.85rem', color: '#334155' }}
          >
            {field.label}
            {field.required ? <span style={{ color: '#b91c1c' }}> *</span> : null}
            {field.type === 'textarea' ? (
              <textarea
                rows={3}
                disabled={disabled}
                placeholder={field.placeholder}
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => set(e.target.value)}
                style={fieldStyle}
              />
            ) : field.type === 'multiselect' ? (
              <select
                multiple
                disabled={disabled}
                value={Array.isArray(value) ? value.map(String) : []}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                  set(selected);
                }}
                style={{ ...fieldStyle, minHeight: 72 }}
              >
                {(field.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : field.type === 'select' || field.type === 'radio' ? (
              <select
                disabled={disabled}
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => set(e.target.value)}
                style={fieldStyle}
              >
                <option value="">Select…</option>
                {(field.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : field.type === 'checkbox' ? (
              <input
                type="checkbox"
                disabled={disabled}
                checked={value === true}
                onChange={(e) => set(e.target.checked)}
              />
            ) : field.type === 'number' ? (
              <input
                type="number"
                disabled={disabled}
                placeholder={field.placeholder}
                value={typeof value === 'number' ? value : typeof value === 'string' ? value : ''}
                onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))}
                style={fieldStyle}
              />
            ) : (
              <input
                type={field.type === 'date' ? 'date' : 'text'}
                disabled={disabled}
                placeholder={field.placeholder}
                value={typeof value === 'string' ? value : ''}
                onChange={(e) => set(e.target.value)}
                style={fieldStyle}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}
