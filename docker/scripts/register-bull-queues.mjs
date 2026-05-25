/**
 * Registers empty BullMQ queues in Redis so Bull Board lists them before the API starts.
 * Keep in sync with apps/api/src/queues/queue.constants.ts
 */
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const QUEUE_NAMES = [
  'entity-provisioning',
  'bulk-enrollment',
  'student-csv-import',
  'billing-daily-snapshot',
  'billing-monthly',
  'billing-lock-invoice',
  'billing-retroactive',
  'finance-bulk-charge',
  'finance-payment-reminder',
  'ai-embed-content',
  'lms-transcode',
  'sports-eligibility',
  'notification-dispatch',
  'notification-bulk',
  'notification-scheduled',
  'webhook-delivery',
];

const redisUrl = process.env.REDIS_URL?.trim() || 'redis://redis:6379';
const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

for (const name of QUEUE_NAMES) {
  const queue = new Queue(name, { connection });
  await queue.getJobCounts();
  await queue.close();
}

await connection.quit();
console.log(`Registered ${QUEUE_NAMES.length} BullMQ queues at ${redisUrl}`);
