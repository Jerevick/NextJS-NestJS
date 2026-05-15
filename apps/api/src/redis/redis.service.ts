import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly log = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor() {
    const url = process.env.REDIS_URL?.trim();
    if (!url) {
      return;
    }
    try {
      this.client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
      void this.client.connect().catch((err: unknown) => {
        this.log.warn(`Redis connect failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    } catch (e) {
      this.log.warn(`Redis init skipped: ${e instanceof Error ? e.message : String(e)}`);
      this.client = null;
    }
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  /** Raw client for Redis-backed throttler and other advanced usage. */
  getClient(): Redis | null {
    return this.client;
  }

  async revokeRefreshJti(jti: string, ttlSec = 604_800): Promise<void> {
    if (!this.client) {
      return;
    }
    try {
      await this.client.set(`refresh:revoked:${jti}`, '1', 'EX', ttlSec);
    } catch (e) {
      this.log.warn(`Redis SET failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async isRefreshJtiRevoked(jti: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    try {
      const v = await this.client.exists(`refresh:revoked:${jti}`);
      return v === 1;
    } catch (e) {
      this.log.warn(`Redis EXISTS failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }

  /** Blocklist a short-lived access JWT `jti` (default matches 15m access TTL). */
  async blockAccessJti(jti: string, ttlSec = 900): Promise<void> {
    if (!this.client) {
      return;
    }
    try {
      await this.client.set(`access:blocked:${jti}`, '1', 'EX', ttlSec);
    } catch (e) {
      this.log.warn(`Redis access blocklist SET failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async isAccessJtiBlocked(jti: string): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    try {
      const v = await this.client.exists(`access:blocked:${jti}`);
      return v === 1;
    } catch (e) {
      this.log.warn(`Redis access blocklist EXISTS failed: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }

  async getCachedString(key: string): Promise<string | null> {
    if (!this.client) {
      return null;
    }
    try {
      return await this.client.get(key);
    } catch (e) {
      this.log.warn(`Redis GET failed: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }

  async setCachedString(key: string, value: string, ttlSec: number): Promise<void> {
    if (!this.client) {
      return;
    }
    try {
      await this.client.set(key, value, 'EX', ttlSec);
    } catch (e) {
      this.log.warn(`Redis SET failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  onModuleDestroy() {
    void this.client?.quit();
  }
}
