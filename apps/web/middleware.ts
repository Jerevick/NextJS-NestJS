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
  '/admin',
  '/alumni',
  '/courses',
  '/meetings',
  '/elections',
  '/sports',
  '/enrollment',
  '/attendance',
  '/notifications',
  '/my-courses',
  '/my-attendance',
  '/my-documents',
  '/my-finance',
  '/my-grades',
  '/register-courses',
];

const DASHBOARD_CHILD_PREFIXES = PROTECTED_PREFIXES.filter((prefix) => prefix !== '/dashboard');
const SUPER_ADMIN_HOME = '/dashboard';
const PLATFORM_SUPER_ADMIN_PREFIXES = [
  '/admin/registration-requests',
  '/admin/institutions',
  '/admin/billing',
];
const ALUMNI_PORTAL_PREFIXES = [
  '/alumni/home',
  '/alumni/events',
  '/alumni/jobs',
  '/alumni/profile',
];
const TENANT_MANAGEMENT_PREFIXES = ['/admin', '/students', '/staff'];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function legacyDashboardPath(pathname: string): string | null {
  const prefix = DASHBOARD_CHILD_PREFIXES.find((p) => matchesPrefix(pathname, p));
  return prefix ? `/dashboard${pathname}` : null;
}

function dashboardRewritePath(pathname: string): string | null {
  if (!pathname.startsWith('/dashboard/')) {
    return null;
  }
  const childPath = pathname.slice('/dashboard'.length);
  return DASHBOARD_CHILD_PREFIXES.some((p) => matchesPrefix(childPath, p)) ? childPath : null;
}

function redirectTo(pathname: string, request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL(pathname, request.url));
}

function isPlatformSuperAdminPath(pathname: string): boolean {
  return PLATFORM_SUPER_ADMIN_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

function isAlumniPortalPath(pathname: string): boolean {
  return ALUMNI_PORTAL_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

function blockedTenantManagementPath(pathname: string): boolean {
  return TENANT_MANAGEMENT_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

function roleRedirect(
  role: string | undefined,
  pathname: string,
  scopedPathname: string,
  request: NextRequest,
): NextResponse | null {
  if (role === 'SUPER_ADMIN') {
    if (pathname === '/dashboard') {
      return null;
    }
    return isPlatformSuperAdminPath(scopedPathname) ? null : redirectTo(SUPER_ADMIN_HOME, request);
  }

  if (matchesPrefix(scopedPathname, '/admin')) {
    if (isPlatformSuperAdminPath(scopedPathname)) {
      return redirectTo('/dashboard', request);
    }
    return role === 'ADMIN' ? null : redirectTo('/dashboard', request);
  }

  if (role === 'GUARDIAN') {
    if (pathname === '/dashboard') {
      return redirectTo('/dashboard/guardian/dashboard', request);
    }
    return blockedTenantManagementPath(scopedPathname)
      ? redirectTo('/dashboard/guardian/dashboard', request)
      : null;
  }

  if (role === 'STUDENT') {
    return blockedTenantManagementPath(scopedPathname) || matchesPrefix(scopedPathname, '/guardian')
      ? redirectTo('/dashboard', request)
      : null;
  }

  if (role === 'ALUMNI') {
    if (pathname === '/dashboard') {
      return redirectTo('/dashboard/alumni/home', request);
    }
    if (matchesPrefix(scopedPathname, '/alumni') && !isAlumniPortalPath(scopedPathname)) {
      return redirectTo('/dashboard/alumni/home', request);
    }
    return blockedTenantManagementPath(scopedPathname)
      ? redirectTo('/dashboard/alumni/home', request)
      : null;
  }

  return null;
}

export default auth((req) => {
  const request = req as unknown as NextRequest;
  const { pathname } = request.nextUrl;
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase() ?? '';
  const resolved = resolveEntityFromHost(host);
  const dashboardPath = legacyDashboardPath(pathname);
  const rewritePath = dashboardRewritePath(pathname);
  const scopedPathname = rewritePath ?? pathname;
  const canonicalPathname = dashboardPath ?? pathname;

  const requestHeaders = new Headers(request.headers);
  if (resolved?.entityCode) {
    requestHeaders.set('x-entity-code', resolved.entityCode.toUpperCase());
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => matchesPrefix(pathname, p));

  if (isProtected && (!req.auth?.accessToken || req.auth.authError === 'SessionExpired')) {
    const login = new URL('/login', request.url);
    login.searchParams.set('callbackUrl', canonicalPathname);
    return NextResponse.redirect(login);
  }

  if (
    isProtected &&
    req.auth &&
    !req.auth.user?.permissions?.includes('*') &&
    req.auth.user?.institutionTermsAccepted !== true
  ) {
    const terms = new URL('/terms', request.url);
    terms.searchParams.set('callbackUrl', canonicalPathname);
    return NextResponse.redirect(terms);
  }

  if (
    isProtected &&
    req.auth?.user?.forcePasswordChange === true &&
    !pathname.startsWith('/change-password')
  ) {
    const changePassword = new URL('/change-password', request.url);
    changePassword.searchParams.set('callbackUrl', canonicalPathname);
    return NextResponse.redirect(changePassword);
  }

  if (isProtected && req.auth) {
    const redirect = roleRedirect(req.auth.user?.role, pathname, scopedPathname, request);
    if (redirect) {
      return redirect;
    }
  }

  if (scopedPathname.startsWith('/entities') && req.auth?.user?.entityScope !== 'ALL') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (
    scopedPathname.startsWith('/billing') &&
    req.auth &&
    !req.auth.user?.permissions?.includes('*') &&
    !req.auth.user?.permissions?.includes('billing.read') &&
    !req.auth.user?.permissions?.includes('billing.write')
  ) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (dashboardPath) {
    const redirectUrl = new URL(request.url);
    redirectUrl.pathname = dashboardPath;
    return NextResponse.redirect(redirectUrl);
  }

  if (rewritePath) {
    const rewrite = new URL(request.url);
    rewrite.pathname = rewritePath;
    return NextResponse.rewrite(rewrite, { request: { headers: requestHeaders } });
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|login|register|terms|forgot-password).*)',
  ],
};
