import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC_ROOT = join(__dirname, '..', '..');

function listControllerFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (name.endsWith('.controller.ts')) {
        out.push(full);
      }
    }
  };
  walk(SRC_ROOT);
  return out;
}

describe('guard coverage audit (Phase 16)', () => {
  it('student write controllers reference StudentRecordWrite or are exempt', () => {
    const studentWritePatterns = [
      /grades\.controller\.ts$/,
      /enrollment\.controller\.ts$/,
      /attendance\.controller\.ts$/,
      /lms-assessments\.controller\.ts$/,
    ];
    const exemptControllers = [/bulk-enrollment\.controller\.ts$/];
    const missing: string[] = [];
    for (const file of listControllerFiles()) {
      if (exemptControllers.some((p) => p.test(file))) continue;
      if (!studentWritePatterns.some((p) => p.test(file))) continue;
      const text = readFileSync(file, 'utf8');
      if (
        !text.includes('StudentRecordWrite') &&
        !text.includes('@Public()') &&
        !text.includes('SkipStudentRecordPosting')
      ) {
        missing.push(file.replace(SRC_ROOT, ''));
      }
    }
    expect(missing).toEqual([]);
  });

  it('global JwtAuthGuard and InstitutionScopeGuard are registered', () => {
    const appModule = readFileSync(join(SRC_ROOT, 'app.module.ts'), 'utf8');
    expect(appModule).toContain('JwtAuthGuard');
    expect(appModule).toContain('InstitutionScopeGuard');
    expect(appModule).toContain('EntityScopeGuard');
    expect(appModule).toContain('PositionGuard');
    expect(appModule).toContain('ScopeGuard');
    expect(appModule).toContain('StudentRecordPostingGuard');
  });
});
