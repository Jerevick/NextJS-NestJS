import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PrismaService } from '../prisma/prisma.service';
import { StaffCalendarIntegrationService } from './staff-calendar-integration.service';

@Controller('staff/calendar-connect')
@UseGuards(PermissionsGuard)
export class StaffCalendarConnectController {
  constructor(
    private readonly calendar: StaffCalendarIntegrationService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('status')
  @RequirePermissions('staff.read')
  status() {
    return {
      google: this.calendar.isGoogleConfigured(),
      microsoft: this.calendar.isMicrosoftConfigured(),
    };
  }

  @Get('google/url')
  @RequirePermissions('staff.read')
  googleUrl(@CurrentUser() user: AuthUser) {
    return { url: this.calendar.googleConnectUrl(user.userId, user.institutionId) };
  }

  @Get('google')
  @RequirePermissions('staff.read')
  googleStart(@CurrentUser() user: AuthUser, @Res() res: Response) {
    try {
      const url = this.calendar.googleConnectUrl(user.userId, user.institutionId);
      return res.redirect(302, url);
    } catch (e) {
      return res.status(503).json({ error: String(e) });
    }
  }

  @Public()
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    const webBase = process.env.WEB_PUBLIC_URL?.trim() ?? 'http://localhost:3000';
    if (!code || !state) {
      return res.redirect(`${webBase}/staff?calendar=error`);
    }
    try {
      const { userId, institutionId, refreshToken } = await this.calendar.exchangeGoogleCode(
        code,
        state,
      );
      const user = await this.prisma.user.findFirst({
        where: { id: userId, institutionId },
        select: { profile: true },
      });
      if (!user) {
        return res.redirect(`${webBase}/staff?calendar=error`);
      }
      const profile = this.calendar.mergeCalendarIntegrations(
        user.profile as Record<string, unknown> | null,
        { google: { refreshToken, calendarId: 'primary' } },
      );
      await this.prisma.user.update({
        where: { id: userId },
        data: { profile: profile as object },
      });
      return res.redirect(`${webBase}/staff?calendar=google_connected`);
    } catch {
      return res.redirect(`${webBase}/staff?calendar=error`);
    }
  }

  @Get('microsoft/url')
  @RequirePermissions('staff.read')
  microsoftUrl(@CurrentUser() user: AuthUser) {
    return { url: this.calendar.microsoftConnectUrl(user.userId, user.institutionId) };
  }

  @Get('microsoft')
  @RequirePermissions('staff.read')
  microsoftStart(@CurrentUser() user: AuthUser, @Res() res: Response) {
    try {
      const url = this.calendar.microsoftConnectUrl(user.userId, user.institutionId);
      return res.redirect(302, url);
    } catch (e) {
      return res.status(503).json({ error: String(e) });
    }
  }

  @Public()
  @Get('microsoft/callback')
  async microsoftCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    const webBase = process.env.WEB_PUBLIC_URL?.trim() ?? 'http://localhost:3000';
    if (!code || !state) {
      return res.redirect(`${webBase}/staff?calendar=error`);
    }
    try {
      const { userId, institutionId, refreshToken } = await this.calendar.exchangeMicrosoftCode(
        code,
        state,
      );
      const user = await this.prisma.user.findFirst({
        where: { id: userId, institutionId },
        select: { profile: true },
      });
      if (!user) {
        return res.redirect(`${webBase}/staff?calendar=error`);
      }
      const profile = this.calendar.mergeCalendarIntegrations(
        user.profile as Record<string, unknown> | null,
        { microsoft: { refreshToken } },
      );
      await this.prisma.user.update({
        where: { id: userId },
        data: { profile: profile as object },
      });
      return res.redirect(`${webBase}/staff?calendar=microsoft_connected`);
    } catch {
      return res.redirect(`${webBase}/staff?calendar=error`);
    }
  }
}
