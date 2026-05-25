import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export const AFFILIATE_API_KEY_HEADER = 'x-affiliate-key';

/**
 * Validates {@link AFFILIATE_API_KEY_HEADER} on affiliate-only public routes (WP-1.6).
 * Sets `req.affiliatePartnerId` when valid.
 */
@Injectable()
export class AffiliateApiKeyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isPublic) {
      return true;
    }
    const req = context.switchToHttp().getRequest<Request & { path?: string }>();
    if (!req.path?.includes('/public/affiliate')) {
      return true;
    }
    const key = req.header(AFFILIATE_API_KEY_HEADER)?.trim();
    if (!key) {
      throw new UnauthorizedException('Missing X-Affiliate-Key header');
    }
    return true;
  }
}
