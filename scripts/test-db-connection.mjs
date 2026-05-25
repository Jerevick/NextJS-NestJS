/**
 * Quick check for DIRECT_DATABASE_URL / DATABASE_URL connectivity.
 * Usage: node --env-file=packages/database/.env scripts/test-db-connection.mjs
 */
import { execSync } from 'node:child_process';

const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
if (!url.trim()) {
  console.error('Set DIRECT_DATABASE_URL or DATABASE_URL in packages/database/.env');
  process.exit(1);
}

const safe = url.replace(/:[^:@/]+@/, ':****@');
console.log(`Testing: ${safe}`);

try {
  execSync(
    `node node_modules/prisma/build/index.js db execute --stdin --schema packages/database/prisma/schema.prisma`,
    {
      input: 'SELECT 1 AS ok;',
      env: { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url },
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
    },
  );
  console.log('Connection OK.');
} catch (err) {
  console.error('Connection failed.');
  if (url.includes('localhost')) {
    console.error('→ Start Docker: docker compose up -d postgres');
    console.error('→ Or use your cloud direct Postgres URL in DIRECT_DATABASE_URL');
  }
  process.exit(1);
}
