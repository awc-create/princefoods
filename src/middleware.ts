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

// Dev hosts where both public and admin routes coexist on the same origin
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

function redirectToAdminLogin(req: NextRequest, pathname: string, search: string) {
  const url = req.nextUrl.clone();
  url.pathname = '/admin/login';
  url.search = '';
  const cb = isLoginPath(pathname) ? ADMIN_ROOT : `${pathname}${search || ''}` || ADMIN_ROOT;
  url.searchParams.set('callbackUrl', cb);
  return NextResponse.redirect(url);
}

function redirectToLogin(req: NextRequest, callbackUrl: string) {
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  url.searchParams.set('callbackUrl', callbackUrl);
  return NextResponse.redirect(url);
}

async function gateAdmin(req: NextRequest, pathname: string, search: string) {
  const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) as Token;
  const role = token?.role;
  const authorised = !!token && (role === 'HEAD' || role === 'STAFF');
  if (!authorised) return redirectToAdminLogin(req, pathname, search);
  return null; // authorised — proceed
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = getHostNoPort(req);

  // ── Always bypass: static, API, auth, login pages ──
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

  // ── Dedicated admin subdomain (prod) ──
  if (ADMIN_HOSTS.has(host)) {
    // Bare root → /admin
    if (pathname === '/' || pathname === '') {
      const url = req.nextUrl.clone();
      url.pathname = ADMIN_ROOT;
      url.search = '';
      return NextResponse.redirect(url);
    }
    if (isAdminPath(pathname)) {
      const block = await gateAdmin(req, pathname, search);
      if (block) return block;
    }
    return NextResponse.next();
  }

  // ── Public production hosts ──
  if (PUBLIC_HOSTS.has(host)) {
    // Hard-block /admin on the public domain
    if (isAdminPath(pathname)) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return NextResponse.redirect(url);
    }
    // Gate /account
    if (pathname === '/account' || pathname.startsWith('/account/')) {
      const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) as Token;
      if (!token) return redirectToLogin(req, `${pathname}${search || ''}`);
    }
    return NextResponse.next();
  }

  // ── Dev / localhost / preview — both public + admin on same origin ──
  if (DEV_HOSTS.has(host) || !PUBLIC_HOSTS.has(host)) {
    if (isAdminPath(pathname)) {
      const block = await gateAdmin(req, pathname, search);
      if (block) return block;
    }
    if (pathname === '/account' || pathname.startsWith('/account/')) {
      const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) as Token;
      if (!token) return redirectToLogin(req, `${pathname}${search || ''}`);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/|api/|assets/|public/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)']
};
