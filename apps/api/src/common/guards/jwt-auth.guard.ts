import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import type { AuthUser } from '../../auth/auth.types';
import { PublicApiKeyService } from '../../integrations/public-api-key.service';
import { PUBLIC_API_KEY_PREFIX } from '../../integrations/integration.types';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const TERMS_ACCEPTANCE_VERSION = 'unicore-terms-v1';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    @Optional() private readonly publicApiKeys?: PublicApiKeyService,
  ) {
    super();
  }

  private isTermsAcceptancePath(req: Request): boolean {
    const path = req.path || req.originalUrl.split('?')[0] || '';
    return /^\/institutions\/[^/]+\/terms\/(acceptance|accept)$/.test(path);
  }

  private isPasswordChangePath(req: Request): boolean {
    const path = req.path || req.originalUrl.split('?')[0] || '';
    return path === '/auth/password/change';
  }

  private async assertInstitutionTermsAccepted(req: Request & { user?: AuthUser }): Promise<void> {
    const user = req.user;
    if (!user || user.permissions.includes('*') || this.isTermsAcceptancePath(req)) {
      return;
    }
    const institution = await this.prisma.institution.findFirst({
      where: { id: user.institutionId, deletedAt: null },
      select: { settings: true },
    });
    const settings =
      institution?.settings &&
      typeof institution.settings === 'object' &&
      !Array.isArray(institution.settings)
        ? (institution.settings as Record<string, unknown>)
        : {};
    const terms =
      settings.termsAcceptance &&
      typeof settings.termsAcceptance === 'object' &&
      !Array.isArray(settings.termsAcceptance)
        ? (settings.termsAcceptance as Record<string, unknown>)
        : null;
    if (terms?.version === TERMS_ACCEPTANCE_VERSION && typeof terms.acceptedAt === 'string') {
      return;
    }
    throw new ForbiddenException('Institution terms must be accepted before accessing UniCore');
  }

  private assertInitialPasswordChanged(req: Request & { user?: AuthUser }): void {
    const user = req.user;
    if (!user || user.forcePasswordChange !== true) {
      return;
    }
    if (this.isPasswordChangePath(req) || this.isTermsAcceptancePath(req)) {
      return;
    }
    throw new ForbiddenException('Temporary password must be changed before accessing UniCore');
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
      await this.assertInstitutionTermsAccepted(req);
      this.assertInitialPasswordChanged(req);
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
    await this.assertInstitutionTermsAccepted(req);
    this.assertInitialPasswordChanged(req);
    return true;
  }
}
