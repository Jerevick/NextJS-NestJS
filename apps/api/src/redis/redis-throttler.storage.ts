import { Injectable, Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from './redis.service';

/**
 * Redis-backed rate limit storage (Phase 1.1).
 * Uses a fixed window counter plus a block key when `limit` is exceeded.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly log = new Logger(RedisThrottlerStorage.name);

  constructor(private readonly redis: RedisService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    const client = this.redis.getClient();
    if (!client) {
      throw new Error('RedisThrottlerStorage requires an active Redis client');
    }
    const hKey = `thr:hits:${throttlerName}:${key}`;
    const bKey = `thr:block:${throttlerName}:${key}`;

    try {
      const blockPttl = await client.pttl(bKey);
      if (blockPttl > 0) {
        const hitStr = await client.get(hKey);
        const totalHits = hitStr ? Number.parseInt(hitStr, 10) : 0;
        const hitPttl = await client.pttl(hKey);
        return {
          totalHits: Number.isFinite(totalHits) ? totalHits : 0,
          timeToExpire: Math.max(0, Math.ceil(hitPttl / 1000)),
          isBlocked: true,
          timeToBlockExpire: Math.max(0, Math.ceil(blockPttl / 1000)),
        };
      }

      const prior = await client.get(hKey);
      const priorHits = prior ? Number.parseInt(prior, 10) : 0;
      if (priorHits > limit) {
        await client.del(hKey);
      }

      const hits = await client.incr(hKey);
      if (hits === 1) {
        await client.pexpire(hKey, ttl);
      }

      const hitPttl = await client.pttl(hKey);
      const timeToExpire = Math.max(0, Math.ceil((hitPttl > 0 ? hitPttl : ttl) / 1000));

      let isBlocked = false;
      let timeToBlockExpire = 0;
      if (hits > limit) {
        await client.set(bKey, '1', 'PX', blockDuration);
        isBlocked = true;
        timeToBlockExpire = Math.max(0, Math.ceil(blockDuration / 1000));
      }

      return { totalHits: hits, timeToExpire, isBlocked, timeToBlockExpire };
    } catch (e) {
      this.log.warn(`Throttler Redis increment failed: ${e instanceof Error ? e.message : String(e)}`);
      return {
        totalHits: 0,
        timeToExpire: Math.ceil(ttl / 1000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }
}
