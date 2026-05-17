import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import * as jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import type { AuthUser } from './auth.types';
import { DisableTotpDto } from './dto/disable-totp.dto';
import { EnableTotpDto } from './dto/enable-totp.dto';
import { LoginDto } from './dto/login.dto';
import { MagicLinkConsumeDto } from './dto/magic-link-consume.dto';
import { MagicLinkRequestDto } from './dto/magic-link-request.dto';
import { SwitchEntityDto } from './dto/switch-entity.dto';

function refreshCookieMaxAgeMs(refreshToken: string): number {
  const decoded = jwt.decode(refreshToken) as { exp?: number } | null;
  if (decoded?.exp) {
    return Math.max(60_000, decoded.exp * 1000 - Date.now());
  }
  return 7 * 24 * 60 * 60 * 1000;
}

@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('mfa/setup')
  mfaSetup(@CurrentUser() user: AuthUser) {
    return this.auth.setupTotp(user);
  }

  @Post('mfa/enable')
  mfaEnable(@CurrentUser() user: AuthUser, @Body() dto: EnableTotpDto) {
    return this.auth.enableTotp(user, dto);
  }

  @Post('mfa/disable')
  mfaDisable(@CurrentUser() user: AuthUser, @Body() dto: DisableTotpDto) {
    return this.auth.disableTotp(user, dto);
  }

  @Public()
  @Post('magic-link/request')
  requestMagicLink(@Req() req: Request, @Body() dto: MagicLinkRequestDto) {
    return this.auth.requestMagicLink(req, dto);
  }

  @Public()
  @Post('magic-link/consume')
  async consumeMagicLink(
    @Body() dto: MagicLinkConsumeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.auth.consumeMagicLink(dto);
    res.cookie(this.auth.refreshCookieName(), refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: refreshCookieMaxAgeMs(refreshToken),
    });
    return { accessToken, user };
  }

  @Public()
  @Post('login')
  async login(
    @Req() req: Request,
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken, user } = await this.auth.login(req, dto);
    res.cookie(this.auth.refreshCookieName(), refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: refreshCookieMaxAgeMs(refreshToken),
    });
    return { accessToken, user };
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[this.auth.refreshCookieName()] as string | undefined;
    const { accessToken, refreshToken } = await this.auth.refresh(token);
    res.cookie(this.auth.refreshCookieName(), refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: refreshCookieMaxAgeMs(refreshToken),
    });
    return { accessToken };
  }

  @Public()
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[this.auth.refreshCookieName()] as string | undefined;
    await this.auth.logout(token);
    res.clearCookie(this.auth.refreshCookieName(), { path: '/' });
    return { ok: true };
  }

  @SkipThrottle()
  @Get('me')
  me(@CurrentUser() user: AuthUser | undefined) {
    if (!user) {
      return { user: null };
    }
    const { accessJti: _accessJti, studentId, ...rest } = user;
    return { user: { ...rest, studentId } };
  }

  @Post('switch-entity')
  async switchEntity(
    @CurrentUser() actor: AuthUser,
    @Body() dto: SwitchEntityDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const currentRefresh = req.cookies?.[this.auth.refreshCookieName()] as string | undefined;
    const { accessToken, refreshToken, user } = await this.auth.switchEntity(
      actor,
      dto.entityId,
      currentRefresh,
    );
    res.cookie(this.auth.refreshCookieName(), refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: refreshCookieMaxAgeMs(refreshToken),
    });
    return { accessToken, user };
  }
}
