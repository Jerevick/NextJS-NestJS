/** Logs which Prisma URL mode migrate will use. */
const dbUrl = process.env.DATABASE_URL ?? '';
const direct = process.env.DIRECT_DATABASE_URL ?? process.env.DIRECT_URL ?? '';

const usesAccelerate =
  dbUrl.startsWith('prisma://') ||
  dbUrl.startsWith('prisma+postgres://') ||
  dbUrl.includes('accelerate.prisma-data.net');

if (usesAccelerate && !direct.trim()) {
  console.log('Using DATABASE_URL from packages/database/.env for cloud migrations.');
}

if (dbUrl.includes('accelerate.prisma-data.net') && direct.trim()) {
  console.log('Using DIRECT_DATABASE_URL for migrations; DATABASE_URL for Accelerate runtime.');
}
