// src/middleware.ts
import type { JWT } from 'next-auth/jwt';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
type Token = (JWT & { role?: Role }) | null;

/** Public and admin hosts */
const PUBLIC_HOSTS = new Set(['prince-v.com', 'www.prince-v.com']);
const ADMIN_HOSTS = new Set(['admin.prince-v.com']);

/** If your real admin app is NOT at /admin, change this to '/app/admin' (or similar) */
const ADMIN_ROOT_INTERNAL = '/admin';

const isLoginPath = (p: string) =>
  p === '/login' || p === '/login/' || p === '/admin/login' || p === '/admin/login/';

const isFile = (p: string) => /\.[a-zA-Z0-9]+$/.test(p);

function getHost(req: NextRequest) {
  return req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.hostname;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = getHost(req);

  // --- Bypass framework/static/API/auth/health/files/login/signup ---
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/public') ||
    pathname.startsWith('/api/healthz') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    isFile(pathname) ||
    isLoginPath(pathname) ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/admin/signup')
  ) {
    return NextResponse.next();
  }

  // --- Public host rules ---
  if (PUBLIC_HOSTS.has(host)) {
    // Block accidental /admin on public host
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // --- Admin host rules ---
  if (ADMIN_HOSTS.has(host)) {
    // 1) Make bare admin root land on your admin app
    if (pathname === '/' || pathname === '') {
      const url = req.nextUrl.clone();
      url.pathname = ADMIN_ROOT_INTERNAL;
      url.search = '';
      // Use redirect so the browser location shows /admin (or your chosen path)
      return NextResponse.redirect(url);
    }

    // 2) If you want /admin to always normalize to the internal root, redirect it
    if (ADMIN_ROOT_INTERNAL !== '/admin' && (pathname === '/admin' || pathname === '/admin/')) {
      const url = req.nextUrl.clone();
      url.pathname = ADMIN_ROOT_INTERNAL;
      return NextResponse.redirect(url);
    }

    // 3) Gate the admin area (wherever it actually is)
    if (
      pathname === ADMIN_ROOT_INTERNAL ||
      pathname.startsWith(
        ADMIN_ROOT_INTERNAL.endsWith('/') ? ADMIN_ROOT_INTERNAL : `${ADMIN_ROOT_INTERNAL}/`
      )
    ) {
      const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) as Token;
      const role: Role | undefined = token?.role;
      const authorised = !!token && (role === 'HEAD' || role === 'STAFF');

      if (!authorised) {
        const url = req.nextUrl.clone();
        url.pathname = '/admin/login';
        // Never point callback to /admin/login itself
        const cbTarget = isLoginPath(pathname)
          ? ADMIN_ROOT_INTERNAL
          : `${pathname}${search || ''}` || ADMIN_ROOT_INTERNAL;
        url.searchParams.set('callbackUrl', cbTarget);
        return NextResponse.redirect(url);
      }
    }
    return NextResponse.next();
  }

  // --- Anything else (localhost/preview/etc.) ---
  return NextResponse.next();
}

export const config = {
  matcher: [
    // run on everything that is NOT one of:
    // _next, api/*, assets/*, public/*, favicon/robots/sitemap, and files with extensions
    '/((?!_next/|api/|assets/|public/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)'
  ]
};
