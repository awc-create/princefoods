// src/middleware.ts
// Handles: server-side /admin auth gate, /account protection,
// public-prod /admin block, and subdomain redirects.
//
// NOTE: /api/ is intentionally skipped here — admin API routes authorise
// themselves via requireAdmin() (see src/lib/require-admin.ts, enforced at
// build time by scripts/check-admin-guards.mjs).
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
  p === '/login' ||
  p === '/login/' ||
  p === '/admin/login' ||
  p === '/admin/login/' ||
  p === '/admin/reset-password' ||
  p.startsWith('/admin/reset-password/') ||
  p === '/admin/set-password' ||
  p.startsWith('/admin/set-password/');

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

  // Admin subdomain: bare / → /admin
  if (ADMIN_HOSTS.has(host) && (pathname === '/' || pathname === '')) {
    const url = req.nextUrl.clone();
    url.pathname = '/admin';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // 🔒 Server-side gate for every /admin page.
  //
  // This MUST happen here. The admin layout is a client component, and a client
  // component cannot stop a server-component child from running: pages like
  // /admin/orders/[id] query Prisma on the server and serialise the result into
  // the response before the browser ever gets a chance to redirect. Without this
  // check, order data (name, email, address, payment refs) is sent to anyone who
  // asks for the URL.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) as Token;
    const role = token?.role;

    if (!token || (role !== 'HEAD' && role !== 'STAFF' && role !== 'VIEWER')) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      url.search = '';
      url.searchParams.set('callbackUrl', `${pathname}${search || ''}`);
      return NextResponse.redirect(url);
    }
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

  return withPathname(req, pathname);
}

export const config = {
  matcher: ['/((?!_next/|api/|assets/|public/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)']
};
