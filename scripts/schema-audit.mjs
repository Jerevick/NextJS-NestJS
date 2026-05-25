#!/usr/bin/env node
/**
 * WP-0.4 — Lists Prisma models missing standard scoped indexes.
 * Run: node scripts/schema-audit.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = join(root, 'packages/database/prisma/schema.prisma');
const text = readFileSync(schemaPath, 'utf8');

const models = [...text.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map((m) => ({
  name: m[1],
  body: m[2],
}));

const scoped = models.filter((m) => /\n\s+institutionId\s+String/.test(m.body));
const missingDeletedAt = scoped.filter((m) => !/\n\s+deletedAt\s+DateTime/.test(m.body));
const missingEntityId = scoped.filter((m) => !/\n\s+entityId\s+String/.test(m.body));
const missingTripleIndex = scoped.filter(
  (m) => !/@@index\(\[institutionId, entityId, deletedAt\]\)/.test(m.body),
);

const lines = [
  '# Schema audit (auto-generated)',
  '',
  `Generated: ${new Date().toISOString().slice(0, 10)}`,
  '',
  `Total models: ${models.length}`,
  `Tenant-scoped (institutionId): ${scoped.length}`,
  '',
  '## P0 — Models with institutionId but no deletedAt',
  '',
  missingDeletedAt.length
    ? missingDeletedAt.map((m) => `- ${m.name} (junction/config — may be intentional)`).join('\n')
    : '_None_',
  '',
  '## Models with institutionId but no entityId',
  '',
  missingEntityId.length
    ? missingEntityId.map((m) => `- ${m.name}`).join('\n')
    : '_None (institution-wide models expected)_',
  '',
  '## Scoped models missing @@index([institutionId, entityId, deletedAt])',
  '',
  missingTripleIndex.length
    ? missingTripleIndex.map((m) => `- ${m.name}`).join('\n')
    : '_None_',
  '',
  '## Recommendation',
  '',
  'Add composite index only where entityId exists and soft-delete applies.',
];

const out = join(root, 'docs/schema-audit-2026-05-22.md');
writeFileSync(out, lines.join('\n'));
console.log(`Wrote ${out}`);
