import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC_ROOT = join(__dirname, '..', '..');

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist') continue;
      walkTsFiles(full, out);
    } else if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Documented exceptions — shrink this list as each path moves to soft delete. */
const ALLOWED_DELETE_PATHS = [
  /student-deletion\.service\.ts$/, // permanent anonymisation: hard-delete auth user
  /notification-digest\.service\.ts$/, // ephemeral digest queue rows
  /user-entity-access\.service\.ts$/, // junction revoke (no deletedAt on model)
  /staff\.service\.ts$/, // junction revoke
  /lms-assessments\.repository\.ts$/, // draft question replace (tracked: WP-8.3)
  /lms-question-bank\.repository\.ts$/, // bank item replace (tracked: WP-8.3)
];

describe('soft delete audit (WP-X.1)', () => {
  it('no prisma.*.delete( or deleteMany( in service code except allowlist', () => {
    const hits: string[] = [];
    for (const file of walkTsFiles(SRC_ROOT)) {
      if (ALLOWED_DELETE_PATHS.some((p) => p.test(file))) continue;
      const text = readFileSync(file, 'utf8');
      if (/\.deleteMany\s*\(/.test(text) || /\.delete\s*\(\s*\{/.test(text)) {
        hits.push(file.replace(SRC_ROOT, ''));
      }
    }
    expect(hits).toEqual([]);
  });
});
