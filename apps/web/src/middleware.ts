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
  const publicPaths = ['/', '/login', '/register', '/forgot-password'];
  return publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default auth((req) => {
  const r = req as unknown as NextRequest;
  const path = r.nextUrl.pathname;
  if (isPublicPath(path)) {
    return NextResponse.next();
  }
  if (!req.auth) {
    const url = new URL('/login', r.nextUrl.origin);
    url.searchParams.set('callbackUrl', `${path}${r.nextUrl.search}`);
    return NextResponse.redirect(url);
  }
  if (path.startsWith('/admin')) {
    const role = req.auth.user?.role;
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', r.nextUrl.origin));
    }
  }
  const role = req.auth.user?.role;
  if (role === 'GUARDIAN' && path === '/dashboard') {
    return NextResponse.redirect(new URL('/guardian/dashboard', r.nextUrl.origin));
  }
  if (role === 'STUDENT' && (path.startsWith('/students') || path.startsWith('/staff'))) {
    return NextResponse.redirect(new URL('/dashboard', r.nextUrl.origin));
  }
  if (role === 'ALUMNI') {
    const alumniPortalPaths = ['/alumni/home', '/alumni/events', '/alumni/jobs', '/alumni/profile'];
    const isAlumniPortal =
      alumniPortalPaths.some((p) => path === p || path.startsWith(`${p}/`)) ||
      path.startsWith('/api/portal/alumni');

    if (path === '/dashboard') {
      return NextResponse.redirect(new URL('/alumni/home', r.nextUrl.origin));
    }
    if (path === '/alumni' || (path.startsWith('/alumni/') && !isAlumniPortal)) {
      return NextResponse.redirect(new URL('/alumni/home', r.nextUrl.origin));
    }
    if (path.startsWith('/students') || path.startsWith('/staff') || path.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/alumni/home', r.nextUrl.origin));
    }
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
