import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const TTL_SEC = 3600;

@Injectable()
export class FinanceBalanceCacheService {
  private readonly log = new Logger(FinanceBalanceCacheService.name);

  constructor(private readonly redis: RedisService) {}

  private key(institutionId: string, studentId: string) {
    return `finance:balance:${institutionId}:${studentId}`;
  }

  async getCachedBalance(institutionId: string, studentId: string): Promise<number | null> {
    const client = this.redis.getClient();
    if (!client) {
      return null;
    }
    try {
      const raw = await client.get(this.key(institutionId, studentId));
      if (raw == null) {
        return null;
      }
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    } catch (e) {
      this.log.warn(`balance cache GET failed: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }

  async setCachedBalance(institutionId: string, studentId: string, balance: number): Promise<void> {
    const client = this.redis.getClient();
    if (!client) {
      return;
    }
    try {
      await client.set(this.key(institutionId, studentId), String(balance), 'EX', TTL_SEC);
    } catch (e) {
      this.log.warn(`balance cache SET failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async invalidate(institutionId: string, studentId: string): Promise<void> {
    const client = this.redis.getClient();
    if (!client) {
      return;
    }
    try {
      await client.del(this.key(institutionId, studentId));
    } catch (e) {
      this.log.warn(`balance cache DEL failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
