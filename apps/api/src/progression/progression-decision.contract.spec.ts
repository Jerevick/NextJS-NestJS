import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * LAW P1 / Prompt 19.1 — append-only ledger: ProgressionDecision must not be mutated in services.
 */
describe('ProgressionDecision append-only contract', () => {
  const serviceSrc = readFileSync(join(__dirname, 'progression.service.ts'), 'utf8');

  it('ProgressionService does not call prisma.progressionDecision.update / delete variants', () => {
    expect(serviceSrc).not.toMatch(/\.progressionDecision\s*\.\s*update\s*\(/);
    expect(serviceSrc).not.toMatch(/\.progressionDecision\s*\.\s*updateMany\s*\(/);
    expect(serviceSrc).not.toMatch(/\.progressionDecision\s*\.\s*delete\s*\(/);
    expect(serviceSrc).not.toMatch(/\.progressionDecision\s*\.\s*deleteMany\s*\(/);
  });
});
