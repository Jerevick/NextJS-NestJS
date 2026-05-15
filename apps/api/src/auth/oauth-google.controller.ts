import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';

function refreshCookieMaxAgeMs(refreshToken: string): number {
  const decoded = jwt.decode(refreshToken) as { exp?: number } | null;
  if (decoded?.exp) {
    return Math.max(60_000, decoded.exp * 1000 - Date.now());
  }
  return 7 * 24 * 60 * 60 * 1000;
}

/**
 * Google OAuth against the **API** (optional). Prefer NextAuth on the web app for first-party cookies.
 * Institution-specific client credentials may live in `Institution.settings.oauthGoogle`.
 */
@Controller('auth/oauth/google')
export class OauthGoogleController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Get()
  async start(@Query('institutionSlug') institutionSlug: string | undefined, @Res() res: Response) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(503).json({ error: 'jwt_secret_missing' });
    }
    if (!institutionSlug?.trim()) {
      return res.status(400).json({ error: 'institutionSlug_required' });
    }
    const slug = institutionSlug.trim();
    const creds = await this.auth.getGoogleOAuthAppCredentials(slug);
    if (!creds) {
      return res.status(503).json({ error: 'google_oauth_not_configured' });
    }
    const apiBase = process.env.API_PUBLIC_URL?.trim() ?? `http://localhost:${process.env.PORT ?? '4000'}`;
    const redirectUri = `${apiBase.replace(/\/$/, '')}/auth/oauth/google/callback`;
    const state = jwt.sign({ slug, typ: 'google_oauth' }, secret, { expiresIn: '10m' });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', creds.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    return res.redirect(302, url.toString());
  }

  @Public()
  @Get('callback')
  async callback(
    @Req() req: Request,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const secret = process.env.JWT_SECRET;
    const webBase = process.env.WEB_PUBLIC_URL?.trim() ?? 'http://localhost:3000';
    if (!secret) {
      return res.status(503).json({ error: 'jwt_secret_missing' });
    }
    if (!code || !state) {
      return res.status(400).json({ error: 'missing_code_or_state' });
    }
    let slug: string;
    try {
      const decoded = jwt.verify(state, secret) as { slug?: string; typ?: string };
      if (decoded.typ !== 'google_oauth' || typeof decoded.slug !== 'string') {
        return res.status(400).json({ error: 'invalid_state' });
      }
      slug = decoded.slug;
    } catch {
      return res.status(400).json({ error: 'invalid_state' });
    }

    const creds = await this.auth.getGoogleOAuthAppCredentials(slug);
    if (!creds) {
      return res.status(503).json({ error: 'google_oauth_not_configured' });
    }

    const apiBase = process.env.API_PUBLIC_URL?.trim() ?? `http://localhost:${process.env.PORT ?? '4000'}`;
    const redirectUri = `${apiBase.replace(/\/$/, '')}/auth/oauth/google/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      return res.status(502).json({ error: 'google_token_exchange_failed', detail: await tokenRes.text() });
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    const access = tokenJson.access_token;
    if (!access) {
      return res.status(502).json({ error: 'google_token_missing' });
    }
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access}` },
    });
    if (!profileRes.ok) {
      return res.status(502).json({ error: 'google_profile_failed' });
    }
    const profile = (await profileRes.json()) as { email?: string };
    const email = profile.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'google_email_missing' });
    }

    const session = await this.auth.issueSessionForGoogleUser(req, slug, email);
    res.cookie(this.auth.refreshCookieName(), session.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: refreshCookieMaxAgeMs(session.refreshToken),
    });

    const accept = req.headers.accept ?? '';
    if (accept.includes('application/json')) {
      return res.json({
        accessToken: session.accessToken,
        user: session.user,
      });
    }

    const dest = new URL('/login', webBase.replace(/\/$/, ''));
    dest.searchParams.set('googleApi', '1');
    return res.redirect(302, dest.toString());
  }
}
