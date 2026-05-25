import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith('/api/auth')) {
    return true;
  }
  if (pathname.startsWith('/_next')) {
    return true;
  }
  if (pathname === '/favicon.ico') {
    return true;
  }
  if (/\.(ico|png|jpg|jpeg|svg|webp|gif|txt|xml|webmanifest)$/i.test(pathname)) {
    return true;
  }
  const publicPaths = ['/', '/login', '/register', '/terms', '/forgot-password'];
  return publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const DASHBOARD_CHILD_PREFIXES = [
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

function redirectTo(pathname: string, req: NextRequest): NextResponse {
  return NextResponse.redirect(new URL(pathname, req.nextUrl.origin));
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
  path: string,
  scopedPath: string,
  req: NextRequest,
): NextResponse | null {
  if (path.startsWith('/change-password')) {
    return null;
  }

  if (role === 'SUPER_ADMIN') {
    if (path === '/dashboard') {
      return null;
    }
    return isPlatformSuperAdminPath(scopedPath) ? null : redirectTo(SUPER_ADMIN_HOME, req);
  }

  if (matchesPrefix(scopedPath, '/admin')) {
    if (isPlatformSuperAdminPath(scopedPath)) {
      return redirectTo('/dashboard', req);
    }
    return role === 'ADMIN' ? null : redirectTo('/dashboard', req);
  }

  if (role === 'GUARDIAN') {
    if (path === '/dashboard') {
      return redirectTo('/dashboard/guardian/dashboard', req);
    }
    return blockedTenantManagementPath(scopedPath)
      ? redirectTo('/dashboard/guardian/dashboard', req)
      : null;
  }

  if (role === 'STUDENT') {
    return blockedTenantManagementPath(scopedPath) || matchesPrefix(scopedPath, '/guardian')
      ? redirectTo('/dashboard', req)
      : null;
  }

  if (role === 'ALUMNI') {
    if (path === '/dashboard') {
      return redirectTo('/dashboard/alumni/home', req);
    }
    if (matchesPrefix(scopedPath, '/alumni') && !isAlumniPortalPath(scopedPath)) {
      return redirectTo('/dashboard/alumni/home', req);
    }
    return blockedTenantManagementPath(scopedPath)
      ? redirectTo('/dashboard/alumni/home', req)
      : null;
  }

  return null;
}

export default auth((req) => {
  const r = req as unknown as NextRequest;
  const path = r.nextUrl.pathname;
  const dashboardPath = legacyDashboardPath(path);
  const rewritePath = dashboardRewritePath(path);
  const scopedPath = rewritePath ?? path;
  const canonicalPath = dashboardPath ?? path;
  if (isPublicPath(path)) {
    return NextResponse.next();
  }
  if (!req.auth) {
    const url = new URL('/login', r.nextUrl.origin);
    url.searchParams.set('callbackUrl', `${canonicalPath}${r.nextUrl.search}`);
    return NextResponse.redirect(url);
  }
  if (
    !req.auth.user?.permissions?.includes('*') &&
    req.auth.user?.institutionTermsAccepted !== true
  ) {
    const url = new URL('/terms', r.nextUrl.origin);
    url.searchParams.set('callbackUrl', `${canonicalPath}${r.nextUrl.search}`);
    return NextResponse.redirect(url);
  }
  if (req.auth.user?.forcePasswordChange === true && !path.startsWith('/change-password')) {
    const url = new URL('/change-password', r.nextUrl.origin);
    url.searchParams.set('callbackUrl', `${canonicalPath}${r.nextUrl.search}`);
    return NextResponse.redirect(url);
  }
  const role = req.auth.user?.role;
  const redirect = roleRedirect(role, path, scopedPath, r);
  if (redirect) {
    return redirect;
  }
  if (dashboardPath) {
    const url = new URL(r.url);
    url.pathname = dashboardPath;
    return NextResponse.redirect(url);
  }
  if (rewritePath) {
    const url = new URL(r.url);
    url.pathname = rewritePath;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
