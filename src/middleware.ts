// src/middleware.ts
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
interface AppToken {
  role?: Role;
}

function normalizeHost(req: NextRequest) {
  const raw =
    req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.hostname;
  return raw.split(',')[0].trim().toLowerCase().replace(/:\d+$/, '');
}

const isPath = (pathname: string, p: string) => pathname === p || pathname === `${p}/`;

const isUnder = (pathname: string, base: string) =>
  pathname.startsWith(base + '/') || pathname === base || pathname === `${base}/`;

const PUBLIC_HOSTS = new Set(['prince-v.com', 'www.prince-v.com']);
const ADMIN_HOSTS = new Set(['admin.prince-v.com']);

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const host = normalizeHost(req);

  // Always allow framework/static/api + both login routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/public') ||
    isPath(pathname, '/login') ||
    isPath(pathname, '/admin/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/admin/signup')
  ) {
    const res = NextResponse.next();
    res.headers.set('x-mw', `allow:${host}`);
    return res;
  }

  // Public host: /admin must never be reachable
  if (PUBLIC_HOSTS.has(host)) {
    if (isUnder(pathname, '/admin')) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      const res = NextResponse.redirect(url);
      res.headers.set('x-mw', `public-block-admin:${host}`);
      return res;
    }
    const res = NextResponse.next();
    res.headers.set('x-mw', `public-pass:${host}`);
    return res;
  }

  // Admin host: require HEAD/STAFF under /admin
  if (ADMIN_HOSTS.has(host)) {
    if (isUnder(pathname, '/admin')) {
      const token = (await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET
      })) as AppToken | null;
      const role = token?.role;
      if (!role || (role !== 'HEAD' && role !== 'STAFF')) {
        const url = req.nextUrl.clone();
        url.pathname = '/admin/login';
        url.search = '';
        url.searchParams.set('callbackUrl', pathname); // path-only to avoid recursion
        const res = NextResponse.redirect(url);
        res.headers.set('x-mw', `admin-gate:${host}`);
        return res;
      }
    }
    const res = NextResponse.next();
    res.headers.set('x-mw', `admin-pass:${host}`);
    return res;
  }

  const res = NextResponse.next();
  res.headers.set('x-mw', `default-pass:${host}`);
  return res;
}

export const config = { matcher: ['/:path*'] };
