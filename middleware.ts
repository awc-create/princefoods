// middleware.ts
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PUBLIC_HOSTS = new Set(['prince-v.com', 'www.prince-v.com']);
const ADMIN_HOSTS = new Set(['admin.prince-v.com']);

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = req.headers.get('host') || req.nextUrl.hostname;

  // Always allow framework/static/api and both login pages
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/public') ||
    pathname === '/login' || // public login
    pathname === '/admin/login' || // admin login
    pathname.startsWith('/signup') ||
    pathname.startsWith('/admin/signup')
  )
    return NextResponse.next();

  // === Public site rules ===
  if (PUBLIC_HOSTS.has(host)) {
    // /admin must never be reachable on the public host
    if (pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    // (Optional) protect /account, /orders, etc.
    // const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    // if (!token && (pathname.startsWith('/account') || pathname.startsWith('/orders'))) {
    //   const url = new URL('/login', req.url);
    //   url.searchParams.set('callbackUrl', pathname + search);
    //   return NextResponse.redirect(url);
    // }
    return NextResponse.next();
  }

  // === Admin site rules ===
  if (ADMIN_HOSTS.has(host)) {
    if (pathname.startsWith('/admin')) {
      const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
      const role = (token as any)?.role as 'HEAD' | 'STAFF' | 'VIEWER' | undefined;
      if (!token || !(role === 'HEAD' || role === 'STAFF')) {
        const url = new URL('/admin/login', req.url);
        url.searchParams.set('callbackUrl', pathname + search);
        return NextResponse.redirect(url);
      }
    }
    return NextResponse.next();
  }

  // Default allow (useful for localhost/preview)
  return NextResponse.next();
}

export const config = { matcher: ['/:path*'] };
