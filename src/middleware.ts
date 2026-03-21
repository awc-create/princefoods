// src/middleware.ts
// NOTE: Admin auth is handled server-side in src/app/admin/AdminGate.tsx
// Middleware only handles: /account protection + public prod /admin block + subdomain redirects
import type { JWT } from 'next-auth/jwt';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
type Token = (JWT & { role?: Role }) | null;

const PUBLIC_HOSTS = new Set([
  'prince-v.com',
  'www.prince-v.com',
  'prince-foods.com',
  'www.prince-foods.com'
]);

const ADMIN_HOSTS = new Set([
  'admin.prince-v.com',
  'admin.prince-foods.com',
  'admin.localhost',
  'admin.127.0.0.1'
]);

function getHostNoPort(req: NextRequest) {
  const raw = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
  return raw.split(',')[0]!.trim().replace(/:\d+$/, '');
}

const isFile = (p: string) => /\.[a-zA-Z0-9]+$/.test(p);
const isLoginPath = (p: string) =>
  p === '/login' || p === '/login/' || p === '/admin/login' || p === '/admin/login/';

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = getHostNoPort(req);

  // Always bypass static/api/auth
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/api/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    isFile(pathname) ||
    isLoginPath(pathname) ||
    pathname.startsWith('/signup')
  ) {
    return NextResponse.next();
  }

  // Admin subdomain: bare / → /admin (no auth check — AdminGate handles that)
  if (ADMIN_HOSTS.has(host) && (pathname === '/' || pathname === '')) {
    const url = req.nextUrl.clone();
    url.pathname = '/admin';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Public prod: hard-block /admin paths
  if (PUBLIC_HOSTS.has(host)) {
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return NextResponse.redirect(url);
    }

    // Protect /account on public domain
    if (pathname === '/account' || pathname.startsWith('/account/')) {
      const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) as Token;
      if (!token) {
        const url = req.nextUrl.clone();
        url.pathname = '/login';
        url.search = '';
        url.searchParams.set('callbackUrl', `${pathname}${search || ''}`);
        return NextResponse.redirect(url);
      }
    }
  }

  // Dev/localhost: protect /account only
  if (!PUBLIC_HOSTS.has(host) && !ADMIN_HOSTS.has(host)) {
    if (pathname === '/account' || pathname.startsWith('/account/')) {
      const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) as Token;
      if (!token) {
        const url = req.nextUrl.clone();
        url.pathname = '/login';
        url.search = '';
        url.searchParams.set('callbackUrl', `${pathname}${search || ''}`);
        return NextResponse.redirect(url);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/|api/|assets/|public/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)']
};
