export type DynamicFormFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'file'
  | 'checkbox'
  | 'radio'
  | 'section_header'
  | 'conditional_logic';

export type ConditionalShowWhen = {
  fieldId: string;
  equals?: unknown;
  notEquals?: unknown;
};

export type DynamicFormField = {
  id: string;
  type: DynamicFormFieldType;
  label: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  /** Show this field only when another field matches (conditional logic). */
  showWhen?: ConditionalShowWhen;
  /** For `file` fields — optional MIME hint, e.g. `application/pdf`. */
  accept?: string;
};

export type DynamicFormSchema = {
  title?: string;
  fields: DynamicFormField[];
};

const INPUT_FIELD_TYPES = new Set<DynamicFormFieldType>([
  'text',
  'textarea',
  'number',
  'date',
  'select',
  'multiselect',
  'file',
  'checkbox',
  'radio',
]);

function parseShowWhen(raw: unknown): ConditionalShowWhen | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const o = raw as Record<string, unknown>;
  const fieldId = typeof o.fieldId === 'string' ? o.fieldId.trim() : '';
  if (!fieldId) {
    return undefined;
  }
  const rule: ConditionalShowWhen = { fieldId };
  if ('equals' in o) {
    rule.equals = o.equals;
  }
  if ('notEquals' in o) {
    rule.notEquals = o.notEquals;
  }
  return rule;
}

export function isFieldVisible(
  field: DynamicFormField,
  responses: Record<string, unknown>,
): boolean {
  if (!field.showWhen) {
    return true;
  }
  const dep = responses[field.showWhen.fieldId];
  if (field.showWhen.equals !== undefined) {
    return dep === field.showWhen.equals;
  }
  if (field.showWhen.notEquals !== undefined) {
    return dep !== field.showWhen.notEquals;
  }
  return dep !== undefined && dep !== null && dep !== '';
}

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
      type !== 'file' &&
      type !== 'checkbox' &&
      type !== 'radio' &&
      type !== 'section_header' &&
      type !== 'conditional_logic'
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
      showWhen: parseShowWhen(f.showWhen),
      accept: typeof f.accept === 'string' ? f.accept : undefined,
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

function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

function isValidFileValue(value: unknown): boolean {
  if (typeof value === 'string' && value.trim()) {
    return true;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    return (
      (typeof o.storageKey === 'string' && o.storageKey.trim() !== '') ||
      (typeof o.url === 'string' && o.url.trim() !== '')
    );
  }
  return false;
}

export function validateDynamicFormResponses(
  schema: DynamicFormSchema,
  responses: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const field of schema.fields) {
    if (field.type === 'section_header' || field.type === 'conditional_logic') {
      continue;
    }
    if (!INPUT_FIELD_TYPES.has(field.type)) {
      continue;
    }
    if (!isFieldVisible(field, responses)) {
      continue;
    }

    const value = responses[field.id];
    const empty = isEmptyValue(value);

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
    if (field.type === 'date' && typeof value !== 'string') {
      errors.push(`${field.label} must be a date string`);
    }
    if (field.type === 'file' && !isValidFileValue(value)) {
      errors.push(`${field.label} must be a file reference (URL or storage key)`);
    }
    if (field.type === 'multiselect') {
      if (!Array.isArray(value)) {
        errors.push(`${field.label} must be a list of options`);
      } else if (field.options?.length) {
        const invalid = value.some((v) => typeof v !== 'string' || !field.options!.includes(v));
        if (invalid) {
          errors.push(`${field.label} has an invalid option`);
        }
      }
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

/** Input fields that collect answers (excludes headers / conditional metadata). */
export function inputFields(schema: DynamicFormSchema): DynamicFormField[] {
  return schema.fields.filter((f) => f.type !== 'section_header' && f.type !== 'conditional_logic');
}
