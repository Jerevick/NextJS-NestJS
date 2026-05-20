import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC_ROOT = join(__dirname, '..', '..');

/** List endpoints upgraded in Phase 16 close-out. */
const CURSOR_ENABLED_LISTS = [
  'notifications/notifications.service.ts',
  'staff/staff.service.ts',
  'progression/progression.service.ts',
  'integrations/webhooks.service.ts',
  'integrations/public-api-key.service.ts',
  'students/students.service.ts',
];

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      walkTsFiles(full, out);
    } else if (name.endsWith('.service.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('cursor pagination audit (Phase 16)', () => {
  it('critical list services expose nextCursor', () => {
    for (const rel of CURSOR_ENABLED_LISTS) {
      const text = readFileSync(join(SRC_ROOT, rel), 'utf8');
      expect(text).toMatch(/nextCursor/);
    }
  });

  it('shared cursor utilities exist', () => {
    expect(readFileSync(join(__dirname, 'cursor-page.util.ts'), 'utf8')).toContain(
      'sliceCursorPage',
    );
    expect(readFileSync(join(__dirname, 'cursor-page-query.dto.ts'), 'utf8')).toContain('cursor?');
  });
});
