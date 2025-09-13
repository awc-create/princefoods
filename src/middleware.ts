// src/middleware.ts
import type { JWT } from 'next-auth/jwt';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
type Token = (JWT & { role?: Role }) | null;

/**
 * Hosts
 * - public:   site
 * - admin:    admin portal
 */
const PUBLIC_HOSTS = new Set(['prince-v.com', 'www.prince-v.com']);
const ADMIN_HOSTS = new Set(['admin.prince-v.com']);

/** quick helpers */
const isLoginPath = (p: string) =>
  p === '/login' || p === '/login/' || p === '/admin/login' || p === '/admin/login/';

const isFile = (p: string) => /\.[a-zA-Z0-9]+$/.test(p);

/** prefer proxy headers (Traefik) */
function getHost(req: NextRequest) {
  return req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.hostname;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = getHost(req);

  // --- Hard bypasses (NEVER touched by middleware) ---
  // Framework + static + API + health + auth + files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/public') ||
    pathname.startsWith('/api/healthz') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/') || // any other API
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
    // We gate everything under /admin (except /admin/login which we bypassed above)
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) as Token;
      const role: Role | undefined = token?.role;

      const authorised = !!token && (role === 'HEAD' || role === 'STAFF');
      if (!authorised) {
        const url = req.nextUrl.clone();
        url.pathname = '/admin/login';
        // Normalise callback target; never point to /admin/login itself
        const cbTarget = isLoginPath(pathname) ? '/admin' : `${pathname}${search}`;
        url.searchParams.set('callbackUrl', cbTarget || '/admin');
        return NextResponse.redirect(url);
      }
    }
    return NextResponse.next();
  }

  // --- Anything else (localhost, preview, etc.) ---
  return NextResponse.next();
}

/**
 * Matcher:
 * - exclude framework, static, files, and *all* API routes (incl health/auth)
 *   so we never even run for those paths (faster + safer).
 */
export const config = {
  matcher: [
    // run on everything that is NOT one of:
    // _next, api/*, assets/*, public/*, favicon/robots/sitemap, and files with extensions
    '/((?!_next/|api/|assets/|public/|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)'
  ]
};
