import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { AuthUser } from '../../auth/auth.types';
import { RedisService } from '../../redis/redis.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const ok = (await super.canActivate(context)) as boolean;
    if (!ok) {
      return false;
    }
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const jti = req.user?.accessJti;
    if (jti && this.redis.isEnabled() && (await this.redis.isAccessJtiBlocked(jti))) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
