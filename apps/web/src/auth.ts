import NextAuth from 'next-auth';
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 15 * 60 },
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
        rememberMe: { label: 'Remember', type: 'text' },
        magicAccessToken: { label: 'Magic access', type: 'text' },
      },
      async authorize(credentials) {
        const raw = credentials as Record<string, unknown> | undefined;
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
            accessToken: magic,
            rememberMe: false,
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
        const rememberMe =
          credentials.rememberMe === 'true' ||
          credentials.rememberMe === '1' ||
          credentials.rememberMe === true;
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
            rememberMe,
          }),
        });
        if (!res.ok) {
          return null;
        }
        const data = (await res.json()) as {
          accessToken: string;
          user: {
            id: string;
            email: string;
            role: string;
            institutionId: string;
            entityId?: string;
            entityScope?: string;
            permissions: string[];
            studentId?: string;
          };
        };
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
          rememberMe,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (trigger === 'update' && session && typeof session === 'object') {
        const s = session as {
          accessToken?: string;
          entityId?: string;
          entityScope?: string;
          omitEntityHeader?: boolean;
        };
        if (typeof s.accessToken === 'string' && s.accessToken) {
          token.accessToken = s.accessToken;
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
      }
      if (user) {
        token.role = (user as { role?: string }).role;
        token.institutionId = (user as { institutionId?: string }).institutionId;
        token.permissions = (user as { permissions?: string[] }).permissions;
        token.accessToken = (user as { accessToken?: string }).accessToken;
        token.entityId = (user as { entityId?: string }).entityId;
        token.entityScope = (user as { entityScope?: string }).entityScope;
        token.studentId = (user as { studentId?: string }).studentId;
        token.omitEntityHeader = false;
        if ((user as { rememberMe?: boolean }).rememberMe) {
          token.remember = true;
        }
      }
      if (token.remember) {
        const far = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
        token.exp = far;
      }
      return token;
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
      }
      if (token.accessToken) {
        session.accessToken = token.accessToken as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
});
