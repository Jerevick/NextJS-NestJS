import {
  parseDynamicFormSchema,
  validateDynamicFormResponses,
  type DynamicFormSchema,
} from './dynamic-form.schema';

describe('parseDynamicFormSchema', () => {
  it('returns null for non-objects', () => {
    expect(parseDynamicFormSchema(null)).toBeNull();
    expect(parseDynamicFormSchema([])).toBeNull();
    expect(parseDynamicFormSchema('x')).toBeNull();
  });

  it('returns null when fields array is missing or empty', () => {
    expect(parseDynamicFormSchema({})).toBeNull();
    expect(parseDynamicFormSchema({ fields: [] })).toBeNull();
    expect(parseDynamicFormSchema({ fields: [{ id: '', label: 'x', type: 'text' }] })).toBeNull();
  });

  it('parses valid fields and title', () => {
    const schema = parseDynamicFormSchema({
      title: 'Scholarship application',
      fields: [
        { id: 'gpa', type: 'number', label: 'GPA', required: true },
        { id: 'note', type: 'textarea', label: 'Statement' },
        { id: 'hdr', type: 'section_header', label: 'Documents' },
      ],
    });
    expect(schema?.title).toBe('Scholarship application');
    expect(schema?.fields.map((f) => f.id)).toEqual(['gpa', 'note', 'hdr']);
    expect(schema?.fields[0].required).toBe(true);
  });

  it('filters unknown field types', () => {
    const schema = parseDynamicFormSchema({
      fields: [
        { id: 'ok', type: 'text', label: 'Name' },
        { id: 'bad', type: 'file_upload', label: 'File' },
      ],
    });
    expect(schema?.fields).toHaveLength(1);
    expect(schema?.fields[0].id).toBe('ok');
  });
});

describe('validateDynamicFormResponses', () => {
  const schema: DynamicFormSchema = {
    fields: [
      { id: 'name', type: 'text', label: 'Full name', required: true },
      { id: 'gpa', type: 'number', label: 'GPA', required: true },
      { id: 'agree', type: 'checkbox', label: 'Agree to terms', required: true },
      {
        id: 'track',
        type: 'select',
        label: 'Track',
        options: ['Science', 'Arts'],
        required: true,
      },
      { id: 'hdr', type: 'section_header', label: 'Extra' },
      { id: 'note', type: 'textarea', label: 'Note' },
    ],
  };

  it('accepts a complete valid payload', () => {
    const result = validateDynamicFormResponses(schema, {
      name: 'Ada Lovelace',
      gpa: 3.8,
      agree: true,
      track: 'Science',
    });
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('reports missing required fields', () => {
    const result = validateDynamicFormResponses(schema, { name: 'Ada' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('GPA is required');
    expect(result.errors).toContain('Agree to terms is required');
    expect(result.errors).toContain('Track is required');
  });

  it('rejects invalid select and checkbox values', () => {
    const result = validateDynamicFormResponses(schema, {
      name: 'Ada',
      gpa: 3,
      agree: 'yes',
      track: 'Sports',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Agree to terms must be true or false');
    expect(result.errors).toContain('Track has an invalid option');
  });

  it('rejects non-numeric GPA', () => {
    const result = validateDynamicFormResponses(schema, {
      name: 'Ada',
      gpa: 'high',
      agree: true,
      track: 'Arts',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('GPA must be a number');
  });

  it('allows optional fields to be empty', () => {
    const result = validateDynamicFormResponses(schema, {
      name: 'Ada',
      gpa: 3,
      agree: true,
      track: 'Arts',
    });
    expect(result.valid).toBe(true);
  });
});
