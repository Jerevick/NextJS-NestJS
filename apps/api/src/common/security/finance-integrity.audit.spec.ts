import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FINANCE_ROOT = join(__dirname, '..', '..', 'finance');

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkTsFiles(full, out);
    } else if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('finance transaction integrity audit (Phase 16)', () => {
  it('uses immutability guard in finance.repository', () => {
    const repo = readFileSync(join(FINANCE_ROOT, 'finance.repository.ts'), 'utf8');
    expect(repo).toContain('assertFinanceTransactionUpdateAllowed');
    expect(repo).toContain('Only PENDING transactions can be completed');
  });

  it('does not assign amount on financeTransaction.update outside create/complete flow', () => {
    const violations: string[] = [];
    for (const file of walkTsFiles(FINANCE_ROOT)) {
      if (file.endsWith('finance-transaction-immutability.util.ts')) continue;
      const text = readFileSync(file, 'utf8');
      if (
        /financeTransaction\.update\([\s\S]{0,400}?amount\s*:/.test(text) &&
        !file.includes('finance.repository.ts')
      ) {
        violations.push(file.replace(FINANCE_ROOT, ''));
      }
    }
    expect(violations).toEqual([]);
  });
});
