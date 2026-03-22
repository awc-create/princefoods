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

function getHostNoPort(req: NextRequest) {
  const raw = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
  return raw.split(',')[0]!.trim().replace(/:\d+$/, '');
}

const isFile = (p: string) => /\.[a-zA-Z0-9]+$/.test(p);
const isAdminLoginPath = (p: string) => p === '/admin/login' || p === '/admin/login/';
const isLoginPath = (p: string) => p === '/login' || p === '/login/' || isAdminLoginPath(p);

function withPathname(req: NextRequest, pathname: string): NextResponse {
  return NextResponse.next({
    request: {
      headers: new Headers({
        ...Object.fromEntries(req.headers.entries()),
        'x-pathname': pathname
      })
    }
  });
}

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
    return withPathname(req, pathname);
  }

  // ── ADMIN SUBDOMAIN ──────────────────────────────────────────────────────
  if (ADMIN_HOSTS.has(host)) {
    // Bare / → /admin
    if (pathname === '/' || pathname === '') {
      const url = req.nextUrl.clone();
      url.pathname = '/admin';
      url.search = '';
      return NextResponse.redirect(url);
    }

    // Protect all /admin/* paths via middleware JWT check.
    // This is the safe way — no changes to layout files needed.
    const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) as Token;

    if (!token) {
      // Not logged in → send to admin login
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      url.search = '';
      url.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(url);
    }

    if (token.role !== 'HEAD' && token.role !== 'STAFF') {
      // Logged in but not staff → send back to admin login
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      url.search = '';
      return NextResponse.redirect(url);
    }

    // Authenticated staff — allow through
    return withPathname(req, pathname);
  }

  // ── PUBLIC DOMAIN ────────────────────────────────────────────────────────
  if (PUBLIC_HOSTS.has(host)) {
    // Hard-block /admin paths on public domain
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return NextResponse.redirect(url);
    }

    // Protect /account
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

  // ── DEV / LOCALHOST ──────────────────────────────────────────────────────
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

  return withPathname(req, pathname);
}

export const config = {
  matcher: ['/((?!_next/|api/|assets/|public/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)']
};
