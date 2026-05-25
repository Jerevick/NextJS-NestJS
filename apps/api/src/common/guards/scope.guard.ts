import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PositionScope } from '@prisma/client';
import type { AuthUser } from '../../auth/auth.types';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REQUIRE_SCOPE_KEY } from '../decorators/require-scope.decorator';

/** Broader scopes satisfy narrower requirements. */
const SCOPE_RANK: Record<PositionScope, number> = {
  INSTITUTION: 6,
  ENTITY: 5,
  FACULTY: 4,
  DEPARTMENT: 3,
  PROGRAMME: 2,
  UNIT: 1,
  SECTION: 1,
  PERSONAL: 0,
};

@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<PositionScope[] | undefined>(
      REQUIRE_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (!user) {
      return true;
    }
    if (user.permissions.includes('*')) {
      return true;
    }
    const scope = user.position?.scope as PositionScope | undefined;
    if (!scope) {
      throw new ForbiddenException({
        statusCode: 403,
        errorCode: 'POSITION_SCOPE_REQUIRED',
        message: 'No active position scope for this campus context',
      });
    }
    const userRank = SCOPE_RANK[scope] ?? 0;
    const minRequired = Math.max(...required.map((s) => SCOPE_RANK[s] ?? 0));
    if (userRank < minRequired) {
      throw new ForbiddenException({
        statusCode: 403,
        errorCode: 'SCOPE_INSUFFICIENT',
        message: `Requires position scope at least: ${required.join(' or ')}`,
      });
    }
    return true;
  }
}
