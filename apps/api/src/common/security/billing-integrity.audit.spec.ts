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

describe('billing integrity audit (Phase 16)', () => {
  const allowedWriters = new Set([
    join(SRC_ROOT, 'students', 'status', 'status-change.service.ts'),
    join(SRC_ROOT, 'students', 'students.repository.ts'),
    join(SRC_ROOT, 'students', 'students.service.ts'),
  ]);

  /** True when source assigns enrollmentStatus inside a Prisma student update `data` block. */
  function assignsEnrollmentStatusOnStudentUpdate(source: string): boolean {
    const withoutAudit = source.replace(/\.audit\.append\(\{[\s\S]*?\}\);/g, '');
    const patterns = [
      /\.student\.update\(\{[\s\S]{0,800}?data:\s*\{[\s\S]{0,400}?enrollmentStatus\s*:/,
      /tx\.student\.update\(\{[\s\S]{0,800}?data:\s*\{[\s\S]{0,400}?enrollmentStatus\s*:/,
      /updateStudent\([^)]*,\s*\{[\s\S]{0,400}?enrollmentStatus\s*:/,
    ];
    return patterns.some((p) => p.test(withoutAudit));
  }

  it('only StatusChangeService (and student create) write enrollmentStatus on Student.update', () => {
    const violations: string[] = [];
    for (const file of walkTsFiles(SRC_ROOT)) {
      if (allowedWriters.has(file)) continue;
      const text = readFileSync(file, 'utf8');
      if (!assignsEnrollmentStatusOnStudentUpdate(text)) continue;
      violations.push(file.replace(SRC_ROOT, ''));
    }
    expect(violations).toEqual([]);
  });

  it('StatusChangeLog has no update or delete in API source', () => {
    const hits: string[] = [];
    for (const file of walkTsFiles(SRC_ROOT)) {
      const text = readFileSync(file, 'utf8');
      if (/statusChangeLog\.(update|delete|updateMany|deleteMany)/.test(text)) {
        hits.push(file.replace(SRC_ROOT, ''));
      }
    }
    expect(hits).toEqual([]);
  });
});
