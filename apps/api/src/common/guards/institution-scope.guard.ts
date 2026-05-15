import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '../../auth/auth.types';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SKIP_INSTITUTION_SCOPE_KEY } from '../decorators/skip-institution-scope.decorator';

/**
 * Ensures explicit `institutionId` in body or query matches the authenticated user's tenant.
 * Platform users (`permissions` contains `*`) bypass this check.
 */
@Injectable()
export class InstitutionScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_INSTITUTION_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{
      user?: AuthUser;
      body?: unknown;
      query?: Record<string, unknown>;
      institution?: { id: string; slug: string; name: string; status: string };
    }>();
    const user = req.user;
    if (!user) {
      return true;
    }
    if (user.permissions.includes('*')) {
      return true;
    }

    if (
      req.institution &&
      String(req.institution.id) === String(user.institutionId) &&
      req.institution.status === 'SUSPENDED'
    ) {
      throw new ForbiddenException('Institution is suspended');
    }

    const body = req.body;
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const rec = body as Record<string, unknown>;
      if ('institutionId' in rec && rec.institutionId != null && rec.institutionId !== '') {
        if (String(rec.institutionId) !== String(user.institutionId)) {
          throw new ForbiddenException('institutionId does not match authenticated tenant');
        }
      }
    }

    const q = req.query ?? {};
    for (const k of ['institutionId', 'institution_id'] as const) {
      const v = q[k];
      if (v != null && v !== '') {
        const s = Array.isArray(v) ? String(v[0]) : String(v);
        if (s && s !== String(user.institutionId)) {
          throw new ForbiddenException('institutionId query does not match authenticated tenant');
        }
      }
    }

    return true;
  }
}
