// middleware.ts (repo root or src/, pick ONE location only)
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
interface AppToken {
  role?: Role;
}

const PUBLIC_HOSTS = new Set(['prince-v.com', 'www.prince-v.com']);
const ADMIN_HOSTS = new Set(['admin.prince-v.com']);

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = req.headers.get('host') ?? req.nextUrl.hostname;

  // Always allow framework/static/api and both login pages
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/public') ||
    pathname === '/login' ||
    pathname === '/admin/login' ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/admin/signup')
  ) {
    const res = NextResponse.next();
    res.headers.set('x-mw', `allow:${host}`); // debug header
    return res;
  }

  // === Public site rules ===
  if (PUBLIC_HOSTS.has(host)) {
    if (pathname.startsWith('/admin')) {
      // redirect to "/" WITHOUT using new URL(...)
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

  // === Admin site rules ===
  if (ADMIN_HOSTS.has(host)) {
    if (pathname.startsWith('/admin')) {
      const token = (await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET
      })) as AppToken | null;
      const role = token?.role;
      if (!role || (role !== 'HEAD' && role !== 'STAFF')) {
        // redirect to "/admin/login" WITHOUT using new URL(...)
        const url = req.nextUrl.clone();
        url.pathname = '/admin/login';
        url.searchParams.set('callbackUrl', pathname + search);
        const res = NextResponse.redirect(url);
        res.headers.set('x-mw', `admin-gate:${host}`);
        return res;
      }
    }
    const res = NextResponse.next();
    res.headers.set('x-mw', `admin-pass:${host}`);
    return res;
  }

  // Default allow
  const res = NextResponse.next();
  res.headers.set('x-mw', `default-pass:${host}`);
  return res;
}

export const config = { matcher: ['/:path*'] };
