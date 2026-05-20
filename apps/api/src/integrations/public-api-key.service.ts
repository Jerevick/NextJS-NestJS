import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { RedisService } from '../redis/redis.service';
import { generateApiKeyPair, verifyApiKey } from './integration-crypto.util';
import { PUBLIC_API_KEY_PREFIX } from './integration.types';
import { normalizePageLimit, sliceCursorPage } from '../common/pagination/cursor-page.util';
import type { ListIntegrationsQueryDto } from './dto/list-integrations-query.dto';
import { IntegrationsRepository } from './integrations.repository';

function assertApiKeyAdmin(actor: AuthUser): void {
  if (actor.permissions.includes('*')) return;
  if (
    actor.permissions.includes('institutions.write') ||
    actor.permissions.includes('integrations.write')
  ) {
    return;
  }
  throw new ForbiddenException('Missing integrations.write permission');
}

function parseBearerToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

function resolveEntityId(req: Request, keyEntityId: string | null): string {
  const header = req.headers['x-entity-id'];
  const fromHeader = typeof header === 'string' ? header.trim() : '';
  const q = req.query?.entityId;
  const fromQuery =
    typeof q === 'string' ? q.trim() : Array.isArray(q) ? String(q[0] ?? '').trim() : '';
  const requested = fromHeader || fromQuery;
  if (requested) return requested;
  if (keyEntityId) return keyEntityId;
  return '';
}

@Injectable()
export class PublicApiKeyService {
  private readonly memoryBuckets = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly repo: IntegrationsRepository,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
  ) {}

  async list(actor: AuthUser, query: ListIntegrationsQueryDto = {}) {
    assertApiKeyAdmin(actor);
    const limit = normalizePageLimit(query.limit, 50, 100);
    const rows = await this.repo.listApiKeys(actor.institutionId, limit, query.cursor);
    const { data, nextCursor } = sliceCursorPage(rows, limit);
    return { data, nextCursor };
  }

  async create(
    actor: AuthUser,
    input: {
      name: string;
      scopes?: string[];
      rateLimitPerMinute?: number;
      entityId?: string | null;
    },
  ) {
    assertApiKeyAdmin(actor);
    const name = input.name.trim();
    if (name.length < 2) throw new BadRequestException('name must be at least 2 characters');
    const entityId = input.entityId?.trim() || null;
    if (entityId) {
      try {
        await this.repo.assertEntityInInstitution(actor.institutionId, entityId);
      } catch {
        throw new BadRequestException('Invalid or inactive entityId');
      }
    }
    const scopes = (input.scopes?.length ? input.scopes : ['*'])
      .map((s) => s.trim())
      .filter(Boolean);
    const { lookup, fullKey, hash } = generateApiKeyPair(PUBLIC_API_KEY_PREFIX);
    const row = await this.repo.createApiKey({
      institutionId: actor.institutionId,
      entityId,
      name,
      scopes,
      rateLimitPerMinute: input.rateLimitPerMinute ?? 60,
      apiKeyLookup: lookup,
      apiKeyHash: hash,
      createdByUserId: actor.userId,
    });
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'public_api_key.create',
      entity: 'PublicApiKey',
      entityId: row.id,
      newValues: { name, scopes: row.scopes, entityId },
    });
    return { ...row, apiKey: fullKey };
  }

  async revoke(actor: AuthUser, keyId: string) {
    assertApiKeyAdmin(actor);
    const n = await this.repo.revokeApiKey(actor.institutionId, keyId);
    if (!n.count) throw new NotFoundException('API key not found');
    this.audit.append({
      institutionId: actor.institutionId,
      actorId: actor.userId,
      action: 'public_api_key.revoke',
      entity: 'PublicApiKey',
      entityId: keyId,
    });
    return { ok: true };
  }

  /**
   * Validates Bearer API key and returns an AuthUser-shaped principal for guards.
   */
  async authenticateFromRequest(req: Request): Promise<AuthUser | null> {
    const token = parseBearerToken(req);
    if (!token?.startsWith(PUBLIC_API_KEY_PREFIX)) return null;
    const dot = token.indexOf('.');
    if (dot < 0) return null;
    const lookup = token.slice(PUBLIC_API_KEY_PREFIX.length, dot);
    const row = await this.repo.findApiKeyByLookup(lookup);
    if (!row || !verifyApiKey(token, row.apiKeyHash)) {
      throw new UnauthorizedException('Invalid API key');
    }
    if (!(await this.checkRateLimit(row.id, row.rateLimitPerMinute))) {
      throw new UnauthorizedException('API key rate limit exceeded');
    }
    void this.repo.touchApiKeyUsed(row.id);

    const requestedEntity = resolveEntityId(req, row.entityId);
    if (requestedEntity && row.entityId && requestedEntity !== row.entityId) {
      throw new ForbiddenException('API key is scoped to a different entity');
    }
    if (requestedEntity) {
      try {
        await this.repo.assertEntityInInstitution(row.institutionId, requestedEntity);
      } catch {
        throw new ForbiddenException('Invalid entity scope for API key');
      }
    }

    const entityId = requestedEntity || row.entityId || '';
    const scopes = row.scopes.length ? row.scopes : ['*'];
    const permissions = scopes.includes('*')
      ? ['*']
      : scopes.map((s) => (s.includes('.') ? s : `${s}.read`));

    return {
      userId: row.createdByUserId ?? `apikey:${row.id}`,
      email: `apikey+${row.apiKeyLookup}@unicore.local`,
      role: 'ADMIN',
      institutionId: row.institutionId,
      entityId,
      entityScope: entityId ? 'ENTITY' : 'ALL',
      permissions,
    };
  }

  private async checkRateLimit(keyId: string, limitPerMinute: number): Promise<boolean> {
    if (this.redis.isEnabled()) {
      const bucketKey = `apikey:rl:${keyId}:${Math.floor(Date.now() / 60_000)}`;
      const client = this.redis.getClient();
      if (client) {
        const count = await client.incr(bucketKey);
        if (count === 1) {
          await client.expire(bucketKey, 120);
        }
        return count <= limitPerMinute;
      }
    }
    return this.checkRateLimitMemory(keyId, limitPerMinute);
  }

  private checkRateLimitMemory(keyId: string, limitPerMinute: number): boolean {
    const now = Date.now();
    const bucket = this.memoryBuckets.get(keyId);
    if (!bucket || now >= bucket.resetAt) {
      this.memoryBuckets.set(keyId, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    if (bucket.count >= limitPerMinute) return false;
    bucket.count += 1;
    return true;
  }
}
