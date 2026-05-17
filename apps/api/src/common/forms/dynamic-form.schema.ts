export type DynamicFormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'checkbox'
  | 'radio'
  | 'section_header';

export type DynamicFormField = {
  id: string;
  type: DynamicFormFieldType;
  label: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
};

export type DynamicFormSchema = {
  title?: string;
  fields: DynamicFormField[];
};

export function parseDynamicFormSchema(raw: unknown): DynamicFormSchema | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const fieldsRaw = o.fields;
  if (!Array.isArray(fieldsRaw)) {
    return null;
  }
  const fields: DynamicFormField[] = [];
  for (const row of fieldsRaw) {
    if (!row || typeof row !== 'object') continue;
    const f = row as Record<string, unknown>;
    const id = typeof f.id === 'string' ? f.id.trim() : '';
    const type = f.type as DynamicFormFieldType;
    const label = typeof f.label === 'string' ? f.label.trim() : '';
    if (!id || !label) continue;
    if (
      type !== 'text' &&
      type !== 'textarea' &&
      type !== 'number' &&
      type !== 'date' &&
      type !== 'select' &&
      type !== 'multiselect' &&
      type !== 'checkbox' &&
      type !== 'radio' &&
      type !== 'section_header'
    ) {
      continue;
    }
    fields.push({
      id,
      type,
      label,
      required: f.required === true,
      options: Array.isArray(f.options)
        ? f.options.filter((x): x is string => typeof x === 'string')
        : undefined,
      placeholder: typeof f.placeholder === 'string' ? f.placeholder : undefined,
    });
  }
  if (fields.length === 0) {
    return null;
  }
  return {
    title: typeof o.title === 'string' ? o.title : undefined,
    fields,
  };
}

export function validateDynamicFormResponses(
  schema: DynamicFormSchema,
  responses: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const field of schema.fields) {
    if (field.type === 'section_header') {
      continue;
    }
    const value = responses[field.id];
    const empty =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0);
    if (field.required && empty) {
      errors.push(`${field.label} is required`);
      continue;
    }
    if (empty) {
      continue;
    }
    if (field.type === 'number' && typeof value !== 'number' && Number.isNaN(Number(value))) {
      errors.push(`${field.label} must be a number`);
    }
    if (field.type === 'checkbox' && typeof value !== 'boolean') {
      errors.push(`${field.label} must be true or false`);
    }
    if (
      (field.type === 'select' || field.type === 'radio') &&
      field.options?.length &&
      typeof value === 'string' &&
      !field.options.includes(value)
    ) {
      errors.push(`${field.label} has an invalid option`);
    }
  }
  return { valid: errors.length === 0, errors };
}
