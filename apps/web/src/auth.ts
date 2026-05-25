import NextAuth from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';

const apiBase =
  process.env.AUTH_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const googleOAuthEnabled =
  process.env.NEXT_PUBLIC_GOOGLE_OAUTH === '1' &&
  Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

const microsoftOAuthEnabled =
  process.env.NEXT_PUBLIC_MICROSOFT_OAUTH === '1' &&
  Boolean(process.env.AUTH_MICROSOFT_ENTRA_ID && process.env.AUTH_MICROSOFT_ENTRA_SECRET);

const API_REFRESH_COOKIE = 'unicore_refresh';
const ACCESS_TOKEN_REFRESH_SKEW_MS = 60_000;
const INACTIVITY_SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

type ApiAuthUser = {
  id: string;
  email: string;
  role: string;
  institutionId: string;
  entityId?: string;
  entityScope?: string;
  permissions: string[];
  studentId?: string;
  institutionTermsAccepted?: boolean;
  forcePasswordChange?: boolean;
};

type ApiAuthResponse = {
  accessToken?: string;
  refreshToken?: string;
  user?: ApiAuthUser;
};

type AccessTokenClaims = {
  exp?: number;
  role?: string;
  institutionId?: string;
  permissions?: string[];
  entityId?: string;
  entityScope?: string;
  institutionTermsAccepted?: boolean;
  forcePasswordChange?: boolean;
};

function decodeJwtPayload<T extends object>(token: string): T | null {
  const [, payload] = token.split('.');
  if (!payload) {
    return null;
  }
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded)) as T;
  } catch {
    return null;
  }
}

function accessTokenExpiresAt(accessToken: string | undefined): number | undefined {
  if (!accessToken) {
    return undefined;
  }
  const claims = decodeJwtPayload<AccessTokenClaims>(accessToken);
  return typeof claims?.exp === 'number' ? claims.exp * 1000 : undefined;
}

function extractRefreshToken(headers: Headers): string | undefined {
  const getSetCookie = (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
  const values =
    typeof getSetCookie === 'function' ? getSetCookie.call(headers) : [headers.get('set-cookie')];
  for (const value of values) {
    const match = value?.match(new RegExp(`(?:^|,\\s*)${API_REFRESH_COOKIE}=([^;]+)`));
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }
  return undefined;
}

function applyAccessTokenClaims(token: JWT, accessToken: string): void {
  const claims = decodeJwtPayload<AccessTokenClaims>(accessToken);
  token.accessToken = accessToken;
  token.accessTokenExpires = accessTokenExpiresAt(accessToken);
  if (claims?.role) token.role = claims.role;
  if (claims?.institutionId) token.institutionId = claims.institutionId;
  if (Array.isArray(claims?.permissions)) token.permissions = claims.permissions;
  if (typeof claims?.entityId === 'string') token.entityId = claims.entityId;
  if (typeof claims?.entityScope === 'string') token.entityScope = claims.entityScope;
  token.institutionTermsAccepted = claims?.institutionTermsAccepted === true;
  token.forcePasswordChange = claims?.forcePasswordChange === true;
  delete token.authError;
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  if (!token.refreshToken) {
    delete token.accessToken;
    token.authError = 'SessionExpired';
    return token;
  }

  const res = await fetch(`${apiBase}/auth/refresh`, {
    method: 'POST',
    headers: {
      Cookie: `${API_REFRESH_COOKIE}=${encodeURIComponent(String(token.refreshToken))}`,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    delete token.accessToken;
    delete token.refreshToken;
    token.authError = 'SessionExpired';
    return token;
  }

  const body = (await res.json()) as { accessToken?: string; refreshToken?: string };
  if (!body.accessToken) {
    delete token.accessToken;
    delete token.refreshToken;
    token.authError = 'SessionExpired';
    return token;
  }

  applyAccessTokenClaims(token, body.accessToken);
  token.refreshToken = body.refreshToken ?? extractRefreshToken(res.headers) ?? token.refreshToken;
  return token;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: 'jwt',
    maxAge: INACTIVITY_SESSION_MAX_AGE_SECONDS,
    updateAge: 5 * 60,
  },
  providers: [
    ...(googleOAuthEnabled
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!,
          }),
        ]
      : []),
    ...(microsoftOAuthEnabled
      ? [
          MicrosoftEntraID({
            clientId: process.env.AUTH_MICROSOFT_ENTRA_ID!,
            clientSecret: process.env.AUTH_MICROSOFT_ENTRA_SECRET!,
            issuer: `https://login.microsoftonline.com/${process.env.AUTH_MICROSOFT_TENANT_ID ?? 'common'}/v2.0`,
          }),
        ]
      : []),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        institutionSlug: { label: 'Institution slug', type: 'text' },
        mfaToken: { label: 'Authenticator code', type: 'text' },
        magicAccessToken: { label: 'Magic access', type: 'text' },
        magicToken: { label: 'Magic link token', type: 'text' },
      },
      async authorize(credentials) {
        const raw = credentials as Record<string, unknown> | undefined;
        const magicToken =
          typeof raw?.magicToken === 'string' && raw.magicToken.trim()
            ? raw.magicToken.trim()
            : undefined;
        if (magicToken) {
          const res = await fetch(`${apiBase}/auth/magic-link/consume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: magicToken }),
          });
          if (!res.ok) {
            return null;
          }
          const data = (await res.json()) as ApiAuthResponse;
          if (!data.accessToken || !data.user) {
            return null;
          }
          return {
            id: data.user.id,
            email: data.user.email,
            role: data.user.role,
            institutionId: data.user.institutionId,
            entityId: data.user.entityId,
            entityScope: data.user.entityScope,
            permissions: data.user.permissions,
            studentId: data.user.studentId,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken ?? extractRefreshToken(res.headers),
          };
        }

        const magic =
          typeof raw?.magicAccessToken === 'string' && raw.magicAccessToken.trim()
            ? raw.magicAccessToken.trim()
            : undefined;
        if (magic) {
          const r = await fetch(`${apiBase}/auth/me`, {
            headers: { Authorization: `Bearer ${magic}` },
          });
          if (!r.ok) {
            return null;
          }
          const body = (await r.json()) as {
            user?: {
              userId: string;
              email: string;
              role: string;
              institutionId: string;
              entityId?: string;
              entityScope?: string;
              permissions: string[];
              studentId?: string;
              institutionTermsAccepted?: boolean;
              forcePasswordChange?: boolean;
            };
          };
          const u = body.user;
          if (!u) {
            return null;
          }
          return {
            id: u.userId,
            email: u.email,
            role: u.role,
            institutionId: u.institutionId,
            entityId: u.entityId,
            entityScope: u.entityScope,
            permissions: u.permissions,
            studentId: u.studentId,
            institutionTermsAccepted: u.institutionTermsAccepted,
            forcePasswordChange: u.forcePasswordChange,
            accessToken: magic,
          };
        }

        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        const slug =
          typeof credentials.institutionSlug === 'string' ? credentials.institutionSlug : undefined;
        const mfaToken =
          typeof credentials.mfaToken === 'string' && credentials.mfaToken.trim()
            ? credentials.mfaToken.trim()
            : undefined;
        const res = await fetch(`${apiBase}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
            ...(slug ? { institutionSlug: slug } : {}),
            ...(mfaToken ? { mfaToken } : {}),
          }),
        });
        if (!res.ok) {
          return null;
        }
        const data = (await res.json()) as ApiAuthResponse;
        if (!data.accessToken || !data.user) {
          return null;
        }
        return {
          id: data.user.id,
          email: data.user.email,
          role: data.user.role,
          institutionId: data.user.institutionId,
          entityId: data.user.entityId,
          entityScope: data.user.entityScope,
          permissions: data.user.permissions,
          studentId: data.user.studentId,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken ?? extractRefreshToken(res.headers),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (trigger === 'update' && session && typeof session === 'object') {
        const s = session as {
          accessToken?: string;
          refreshToken?: string;
          entityId?: string;
          entityScope?: string;
          omitEntityHeader?: boolean;
          institutionTermsAccepted?: boolean;
          forcePasswordChange?: boolean;
        };
        if (typeof s.accessToken === 'string' && s.accessToken) {
          applyAccessTokenClaims(token, s.accessToken);
        }
        if (typeof s.refreshToken === 'string' && s.refreshToken) {
          token.refreshToken = s.refreshToken;
        }
        if (typeof s.entityId === 'string') {
          token.entityId = s.entityId;
        }
        if (typeof s.entityScope === 'string') {
          token.entityScope = s.entityScope;
        }
        if ('omitEntityHeader' in s) {
          token.omitEntityHeader = Boolean(s.omitEntityHeader);
        }
        if ('institutionTermsAccepted' in s) {
          token.institutionTermsAccepted = Boolean(s.institutionTermsAccepted);
        }
        if ('forcePasswordChange' in s) {
          token.forcePasswordChange = Boolean(s.forcePasswordChange);
        }
      }
      if (user) {
        token.role = (user as { role?: string }).role;
        token.institutionId = (user as { institutionId?: string }).institutionId;
        token.permissions = (user as { permissions?: string[] }).permissions;
        const accessToken = (user as { accessToken?: string }).accessToken;
        if (accessToken) {
          applyAccessTokenClaims(token, accessToken);
        }
        token.refreshToken = (user as { refreshToken?: string }).refreshToken;
        token.entityId = (user as { entityId?: string }).entityId;
        token.entityScope = (user as { entityScope?: string }).entityScope;
        token.studentId = (user as { studentId?: string }).studentId;
        token.institutionTermsAccepted =
          (user as { institutionTermsAccepted?: boolean }).institutionTermsAccepted === true ||
          token.institutionTermsAccepted === true;
        token.forcePasswordChange =
          (user as { forcePasswordChange?: boolean }).forcePasswordChange === true ||
          token.forcePasswordChange === true;
        token.omitEntityHeader = false;
      }
      const expiresAt =
        typeof token.accessTokenExpires === 'number' ? token.accessTokenExpires : undefined;
      if (!expiresAt || Date.now() < expiresAt - ACCESS_TOKEN_REFRESH_SKEW_MS) {
        return token;
      }
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? session.user.id ?? '';
        session.user.role = (token.role as string | undefined) ?? '';
        session.user.institutionId = (token.institutionId as string | undefined) ?? '';
        session.user.permissions = (token.permissions as string[] | undefined) ?? [];
        session.user.entityId = (token.entityId as string | undefined) ?? '';
        session.user.entityScope = (token.entityScope as 'ALL' | 'ENTITY' | undefined) ?? 'ENTITY';
        session.user.omitEntityHeader = token.omitEntityHeader === true;
        session.user.studentId = token.studentId as string | undefined;
        session.user.institutionTermsAccepted = token.institutionTermsAccepted === true;
        session.user.forcePasswordChange = token.forcePasswordChange === true;
      }
      if (token.accessToken && token.authError !== 'SessionExpired') {
        session.accessToken = token.accessToken as string;
      }
      if (token.authError) {
        session.authError = token.authError;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
});
