import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

/** Redis cache TTLs (seconds) — Phase 16 performance strategy. */
export const TENANT_CACHE_TTL = {
  institutionSettings: 300,
  entitySettings: 300,
  userPermissions: 900,
  courseStructure: 1800,
  feeStructures: 3600,
  studentGpa: 3600,
  orgUnitTree: 3600,
  billableCountToday: 86_400,
} as const;

@Injectable()
export class TenantCacheService {
  constructor(private readonly redis: RedisService) {}

  private key(namespace: string, id: string): string {
    return `cache:${namespace}:${id}`;
  }

  async getJson<T>(namespace: string, id: string): Promise<T | null> {
    const raw = await this.redis.getCachedString(this.key(namespace, id));
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(namespace: string, id: string, value: unknown, ttlSec: number): Promise<void> {
    await this.redis.setCachedString(this.key(namespace, id), JSON.stringify(value), ttlSec);
  }

  async invalidate(namespace: string, id: string): Promise<void> {
    const client = this.redis.getClient();
    if (!client) {
      return;
    }
    try {
      await client.del(this.key(namespace, id));
    } catch {
      // Best-effort invalidation when Redis is unavailable.
    }
  }

  /** Delete all keys `cache:<namespace>:<idPrefix>*` (settings cache bust on patch). */
  async invalidatePrefix(namespace: string, idPrefix: string): Promise<void> {
    const client = this.redis.getClient();
    if (!client) {
      return;
    }
    const pattern = `${this.key(namespace, idPrefix)}*`;
    try {
      let cursor = '0';
      do {
        const [next, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 50);
        cursor = next;
        if (keys.length > 0) {
          await client.del(...keys);
        }
      } while (cursor !== '0');
    } catch {
      // Best-effort invalidation when Redis is unavailable.
    }
  }

  async getOrLoad<T>(
    namespace: string,
    id: string,
    ttlSec: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const hit = await this.getJson<T>(namespace, id);
    if (hit !== null) {
      return hit;
    }
    const value = await loader();
    await this.setJson(namespace, id, value, ttlSec);
    return value;
  }
}
