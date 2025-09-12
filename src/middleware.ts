// src/middleware.ts
import type { JWT } from 'next-auth/jwt';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
type Token = (JWT & { role?: Role }) | null;

const PUBLIC_HOSTS = new Set(['prince-v.com', 'www.prince-v.com']);
const ADMIN_HOSTS = new Set(['admin.prince-v.com']);

const isLoginPath = (p: string) =>
  p === '/login' || p === '/login/' || p === '/admin/login' || p === '/admin/login/';

const isFrameworkPath = (p: string) =>
  p.startsWith('/_next') ||
  p.startsWith('/api') ||
  p.startsWith('/assets') ||
  p.startsWith('/public');

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl; // ← remove unused searchParams
  const host = req.headers.get('host') ?? req.nextUrl.hostname;

  // Always allow framework/static & BOTH login variants (+ signups)
  if (
    isFrameworkPath(pathname) ||
    isLoginPath(pathname) ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/admin/signup')
  ) {
    return NextResponse.next();
  }

  // === Public host rules ===
  if (PUBLIC_HOSTS.has(host)) {
    // Never allow /admin on the public host (with or without slash)
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // === Admin host rules ===
  if (ADMIN_HOSTS.has(host)) {
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      // Gate everything under /admin (except /admin/login which is already whitelisted above)
      const token = (await getToken({ req, secret: process.env.NEXTAUTH_SECRET })) as Token;
      const role: Role | undefined = token?.role;

      if (!token || !(role === 'HEAD' || role === 'STAFF')) {
        const url = req.nextUrl.clone();
        url.pathname = '/admin/login'; // trailingSlash is handled by Next
        // Prevent infinite nesting by normalising callback target
        const cb = isLoginPath(pathname) ? '/admin' : `${pathname}${req.nextUrl.search}`;
        url.searchParams.set('callbackUrl', cb);
        return NextResponse.redirect(url);
      }
    }
    return NextResponse.next();
  }

  // Default allow (localhost/preview)
  return NextResponse.next();
}

export const config = { matcher: ['/:path*'] };
