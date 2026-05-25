import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/auth';

const ROOT_DOMAIN = (process.env.APP_ROOT_DOMAIN ?? '').toLowerCase();

function resolveEntityFromHost(
  host: string,
): { institutionSlug: string; entityCode: string | null } | null {
  if (!ROOT_DOMAIN || host === ROOT_DOMAIN || !host.endsWith(`.${ROOT_DOMAIN}`)) {
    return null;
  }
  const sub = host.slice(0, -(ROOT_DOMAIN.length + 1)).replace(/^www\./, '');
  const labels = sub.split('.').filter(Boolean);
  if (labels.length === 0) {
    return null;
  }
  if (labels.length === 1) {
    return { institutionSlug: labels[0]!, entityCode: null };
  }
  return {
    institutionSlug: labels[labels.length - 1]!,
    entityCode: labels.slice(0, -1).join('.'),
  };
}

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/students',
  '/admissions',
  '/billing',
  '/entities',
  '/finance',
  '/lms',
  '/teach',
  '/settings',
  '/workflow',
  '/staff',
  '/guardian',
  '/registrar',
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const host = req.headers.get('host')?.split(':')[0]?.toLowerCase() ?? '';
  const resolved = resolveEntityFromHost(host);

  const requestHeaders = new Headers(req.headers);
  if (resolved?.entityCode) {
    requestHeaders.set('x-entity-code', resolved.entityCode.toUpperCase());
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (pathname.startsWith('/entities') && req.auth?.user?.entityScope !== 'ALL') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  if (
    pathname.startsWith('/billing') &&
    req.auth &&
    !req.auth.user?.permissions?.includes('*') &&
    !req.auth.user?.permissions?.includes('billing.read') &&
    !req.auth.user?.permissions?.includes('billing.write')
  ) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  if (isProtected && !req.auth?.accessToken) {
    const login = new URL('/login', req.url);
    login.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login|register|forgot-password).*)'],
};
