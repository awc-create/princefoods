// src/middleware.ts
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

const DEV_HOSTS = new Set(['localhost', '127.0.0.1']);

const ADMIN_ROOT = '/admin';

const isLoginPath = (p: string) =>
  p === '/login' || p === '/login/' || p === '/admin/login' || p === '/admin/login/';

const isAdminPath = (p: string) =>
  p === ADMIN_ROOT || p === `${ADMIN_ROOT}/` || p.startsWith(`${ADMIN_ROOT}/`);

const isFile = (p: string) => /\.[a-zA-Z0-9]+$/.test(p);

function getHostNoPort(req: NextRequest) {
  const raw =
    req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.hostname ?? '';
  return raw.split(',')[0]!.trim().replace(/:\d+$/, '');
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = getHostNoPort(req);

  // ── Always bypass ──
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/public') ||
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

  const isAdmin = ADMIN_HOSTS.has(host) || DEV_HOSTS.has(host) || !PUBLIC_HOSTS.has(host);
  const isPublicProd = PUBLIC_HOSTS.has(host);

  // ── Public production: hard-block /admin ──
  if (isPublicProd) {
    if (isAdminPath(pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return NextResponse.redirect(url);
    }
    if (pathname === '/account' || pathname.startsWith('/account/')) {
      const token = (await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET,
        cookieName:
          process.env.NODE_ENV === 'production'
            ? '__Secure-next-auth.session-token'
            : 'next-auth.session-token'
      })) as Token;
      if (!token) {
        const url = req.nextUrl.clone();
        url.pathname = '/login';
        url.search = '';
        url.searchParams.set('callbackUrl', `${pathname}${search || ''}`);
        return NextResponse.redirect(url);
      }
    }
    return NextResponse.next();
  }

  // ── Admin subdomain: bare / → /admin ──
  if (ADMIN_HOSTS.has(host) && (pathname === '/' || pathname === '')) {
    const url = req.nextUrl.clone();
    url.pathname = ADMIN_ROOT;
    url.search = '';
    return NextResponse.redirect(url);
  }

  // ── Gate /admin/* on admin subdomains + dev ──
  if (isAdmin && isAdminPath(pathname)) {
    const secret = process.env.NEXTAUTH_SECRET;
    const token = (await getToken({ req, secret })) as Token;
    const role = token?.role;
    const authorised = !!token && (role === 'HEAD' || role === 'STAFF');

    console.log(
      `[middleware] ${host}${pathname} token=${!!token} role=${role ?? 'none'} auth=${authorised}`
    );

    if (!authorised) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      url.search = '';
      const cb = isLoginPath(pathname) ? ADMIN_ROOT : `${pathname}${search || ''}` || ADMIN_ROOT;
      url.searchParams.set('callbackUrl', cb);
      return NextResponse.redirect(url);
    }
  }

  // ── Gate /account/* on dev/preview ──
  if (
    (DEV_HOSTS.has(host) || !PUBLIC_HOSTS.has(host)) &&
    (pathname === '/account' || pathname.startsWith('/account/'))
  ) {
    const token = (await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
      cookieName:
        process.env.NODE_ENV === 'production'
          ? '__Secure-next-auth.session-token'
          : 'next-auth.session-token'
    })) as Token;
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      url.searchParams.set('callbackUrl', `${pathname}${search || ''}`);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/|api/|assets/|public/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)']
};
