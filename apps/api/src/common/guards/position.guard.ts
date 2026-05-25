import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '../../auth/auth.types';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REQUIRE_POSITION_KEY } from '../decorators/require-position.decorator';

@Injectable()
export class PositionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<string[] | undefined>(REQUIRE_POSITION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
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
    const code = user.position?.code;
    if (!code || !required.includes(code)) {
      throw new ForbiddenException({
        statusCode: 403,
        errorCode: 'POSITION_REQUIRED',
        message: `Requires one of positions: ${required.join(', ')}`,
      });
    }
    return true;
  }
}
