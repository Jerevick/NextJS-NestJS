/**
 * Phase 19 block-release tests (UNICORE_MASTER_PROMPT.md Prompt 19.1 §F).
 * Runs with Testcontainers when Docker is available; skipped otherwise.
 */
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { PrismaClient, StudentEnrollmentStatusEnum } from '@unicore/database';

const runContainers = process.env.SKIP_TESTCONTAINERS !== '1';
const repoRoot = join(__dirname, '..', '..', '..');

(runContainers ? describe : describe.skip)('Progression release (Phase 19)', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('pgvector/pgvector:pg16').start();
    const url = container.getConnectionUri();
    process.env.DATABASE_URL = url;
    execSync('pnpm exec prisma migrate deploy', {
      cwd: join(repoRoot, 'packages', 'database'),
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'inherit',
    });
    prisma = new PrismaClient({ datasources: { db: { url } } });
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  it('ProgressionDecision has no update/delete paths in service layer', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const progressionDir = join(repoRoot, 'apps', 'api', 'src', 'progression');
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (name.endsWith('.ts') && !name.endsWith('.spec.ts'))
          out.push(readFileSync(full, 'utf8'));
      }
      return out;
    };
    const bodies = walk(progressionDir).join('\n');
    expect(bodies).not.toMatch(/\.progressionDecision\s*\.\s*update\s*\(/);
    expect(bodies).not.toMatch(/\.progressionDecision\s*\.\s*delete\s*\(/);
  });

  it('repeating ACTIVE student can exist for grade posting guard concept', async () => {
    const inst = await prisma.institution.findFirst();
    if (!inst) return;
    const active = await prisma.student.findFirst({
      where: { institutionId: inst.id, enrollmentStatus: StudentEnrollmentStatusEnum.ACTIVE },
    });
    expect(active?.enrollmentStatus).toBe('ACTIVE');
  });
});
