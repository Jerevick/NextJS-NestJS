import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

type CachedEntity = { id: string; code: string; name: string; status: string };

/**
 * Resolves tenant from (in order): `X-Institution-ID`, custom `domain`, then subdomain of `APP_ROOT_DOMAIN`.
 * Optionally resolves `X-Entity-ID` into `req.entity` (short Redis cache).
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const headerId = req.header('x-institution-id');
    if (headerId) {
      const inst = await this.prisma.institution.findFirst({
        where: { id: headerId, deletedAt: null },
      });
      if (inst) {
        req.institution = {
          id: inst.id,
          slug: inst.slug,
          name: inst.name,
          status: inst.status,
        };
      }
      await this.attachEntityIfRequested(req);
      return next();
    }

    const host = req.hostname?.toLowerCase() ?? '';

    const byDomain = await this.prisma.institution.findFirst({
      where: { domain: host, deletedAt: null },
    });
    if (byDomain) {
      req.institution = {
        id: byDomain.id,
        slug: byDomain.slug,
        name: byDomain.name,
        status: byDomain.status,
      };
      await this.attachEntityIfRequested(req);
      return next();
    }

    const root = (process.env.APP_ROOT_DOMAIN ?? '').toLowerCase();
    if (root && host !== root && host.endsWith(`.${root}`)) {
      const sub = host.slice(0, -(root.length + 1));
      const labels = sub.startsWith('www.') ? sub.slice(4).split('.') : sub.split('.');
      if (labels.length >= 1 && labels[0]) {
        const institutionSlug = labels.length >= 2 ? labels[labels.length - 1]! : labels[0]!;
        const entityCode = labels.length >= 2 ? labels.slice(0, -1).join('.') : null;
        const bySlug = await this.prisma.institution.findFirst({
          where: { slug: institutionSlug, deletedAt: null },
        });
        if (bySlug) {
          req.institution = {
            id: bySlug.id,
            slug: bySlug.slug,
            name: bySlug.name,
            status: bySlug.status,
          };
          if (entityCode) {
            await this.attachEntityByCode(req, bySlug.id, entityCode);
          }
        }
      }
    }

    await this.attachEntityIfRequested(req);
    next();
  }

  private async attachEntityByCode(
    req: Request,
    institutionId: string,
    code: string,
  ): Promise<void> {
    const normalized = code.toUpperCase();
    const cacheKey = `tenant:entity-code:${institutionId}:${normalized}`;
    let parsed: CachedEntity | null = null;
    if (this.redis.isEnabled()) {
      const cached = await this.redis.getCachedString(cacheKey);
      if (cached) {
        try {
          parsed = JSON.parse(cached) as CachedEntity;
        } catch {
          parsed = null;
        }
      }
    }
    if (!parsed) {
      const row = await this.prisma.institutionEntity.findFirst({
        where: { institutionId, code: normalized, deletedAt: null },
        select: { id: true, code: true, name: true, status: true },
      });
      if (!row) {
        throw new BadRequestException(`Unknown campus code "${normalized}" for this institution`);
      }
      parsed = row;
      if (this.redis.isEnabled()) {
        await this.redis.setCachedString(cacheKey, JSON.stringify(parsed), 300);
      }
    }
    if (parsed.status !== 'ACTIVE') {
      throw new ForbiddenException('Campus entity is not active');
    }
    req.entity = parsed;
    req.headers['x-entity-id'] = parsed.id;
  }

  private async attachEntityIfRequested(req: Request): Promise<void> {
    const raw = req.header('x-entity-id')?.trim();
    if (!raw || !req.institution) {
      return;
    }
    const cacheKey = `tenant:entity:${req.institution.id}:${raw}`;
    let parsed: CachedEntity | null = null;
    if (this.redis.isEnabled()) {
      const cached = await this.redis.getCachedString(cacheKey);
      if (cached) {
        try {
          parsed = JSON.parse(cached) as CachedEntity;
        } catch {
          parsed = null;
        }
      }
    }
    if (!parsed) {
      const row = await this.prisma.institutionEntity.findFirst({
        where: { id: raw, institutionId: req.institution.id, deletedAt: null },
        select: { id: true, code: true, name: true, status: true },
      });
      if (!row) {
        throw new BadRequestException('Unknown X-Entity-ID for this institution');
      }
      parsed = row;
      if (this.redis.isEnabled()) {
        await this.redis.setCachedString(cacheKey, JSON.stringify(parsed), 60);
      }
    }
    if (parsed.status !== 'ACTIVE') {
      throw new ForbiddenException('Campus entity is not active');
    }
    req.entity = parsed;
  }
}
