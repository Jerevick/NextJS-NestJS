import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..', '..');

describe('field encryption audit (Phase 16)', () => {
  it('staff salary writes use encryptSensitiveJson', () => {
    const text = readFileSync(join(SRC, 'staff', 'staff-salary.util.ts'), 'utf8');
    expect(text).toContain('encryptSensitiveJson');
    expect(text).toContain('decryptSensitiveJson');
  });

  it('staff profile create/update routes salary through encryptSalary', () => {
    const text = readFileSync(join(SRC, 'staff', 'staff.service.ts'), 'utf8');
    expect(text).toMatch(/encryptSalary/);
    expect(text).toMatch(/decryptSalary/);
  });

  it('AI institution API keys use field encryption helpers', () => {
    const text = readFileSync(join(SRC, 'ai', 'ai-institution-settings.ts'), 'utf8');
    expect(text).toContain('encryptSensitiveJson');
    expect(text).toContain('decryptSensitiveJson');
  });
});
