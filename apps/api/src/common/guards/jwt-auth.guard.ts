import { ExecutionContext, Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import type { AuthUser } from '../../auth/auth.types';
import { PublicApiKeyService } from '../../integrations/public-api-key.service';
import { PUBLIC_API_KEY_PREFIX } from '../../integrations/integration.types';
import { RedisService } from '../../redis/redis.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
    @Optional() private readonly publicApiKeys?: PublicApiKeyService,
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

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const bearer = req.headers.authorization;
    if (bearer?.startsWith('Bearer ') && bearer.slice(7).trim().startsWith(PUBLIC_API_KEY_PREFIX)) {
      if (!this.publicApiKeys) {
        throw new UnauthorizedException('Public API keys are not configured');
      }
      const principal = await this.publicApiKeys.authenticateFromRequest(req);
      if (!principal) {
        throw new UnauthorizedException();
      }
      req.user = principal;
      return true;
    }

    const ok = (await super.canActivate(context)) as boolean;
    if (!ok) {
      return false;
    }
    const jti = req.user?.accessJti;
    if (jti && this.redis.isEnabled() && (await this.redis.isAccessJtiBlocked(jti))) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
