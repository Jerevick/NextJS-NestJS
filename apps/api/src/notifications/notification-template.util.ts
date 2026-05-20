import Handlebars from 'handlebars';

export function renderTemplate(template: string, data: Record<string, unknown>): string {
  try {
    const compiled = Handlebars.compile(template, { noEscape: false });
    return compiled(data);
  } catch {
    return template;
  }
}

export function parseChannelsJson(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { email: true, inApp: true };
  }
  return raw as Record<string, boolean>;
}
