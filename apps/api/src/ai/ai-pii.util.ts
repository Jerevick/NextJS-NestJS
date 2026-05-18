import type { ChatMessage } from './providers/ai-provider.interface';

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const STUDENT_NUM_RE = /\b[A-Z]{0,3}\d{6,12}\b/g;
const PHONE_RE = /\+?\d[\d\s().-]{8,}\d/g;

/** Build stable anonymised labels (Student A, Student B, …). */
export function buildAnonymizedAliasMap(names: string[]): Map<string, string> {
  const unique = [...new Set(names.map((n) => n.trim()).filter((n) => n.length > 1))];
  const map = new Map<string, string>();
  unique.forEach((name, index) => {
    const letter = String.fromCharCode(65 + (index % 26));
    map.set(name, `Student ${letter}`);
  });
  return map;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function anonymizeNamesInText(text: string, aliasMap: Map<string, string>): string {
  let out = text;
  const sorted = [...aliasMap.keys()].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    const alias = aliasMap.get(name)!;
    out = out.replace(new RegExp(escapeRegExp(name), 'gi'), alias);
  }
  return out;
}

/** Redact common PII before sending text to external LLM providers. */
export function scrubTextForExternalAi(text: string, aliasMap?: Map<string, string>): string {
  let out = text
    .replace(EMAIL_RE, '[email]')
    .replace(STUDENT_NUM_RE, '[student-number]')
    .replace(PHONE_RE, '[phone]')
    .replace(/\binstitutionId["']?\s*:\s*["'][^"']+["']/gi, 'institutionId:"[redacted]"')
    .replace(/\bstudentId["']?\s*:\s*["'][^"']+["']/gi, 'studentId:"[redacted]"')
    .replace(/\buserId["']?\s*:\s*["'][^"']+["']/gi, 'userId:"[redacted]"');
  if (aliasMap?.size) {
    out = anonymizeNamesInText(out, aliasMap);
  }
  return out;
}

export function scrubMessagesForExternalAi(
  messages: ChatMessage[],
  aliasMap?: Map<string, string>,
): ChatMessage[] {
  return messages.map((m) => ({
    ...m,
    content: scrubTextForExternalAi(m.content, aliasMap),
  }));
}
