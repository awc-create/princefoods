// src/app/api/auth/[...nextauth]/route.ts
import { authOptions } from '@/lib/auth-options';
import NextAuth from 'next-auth';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// NextAuth v4: NEXTAUTH_URL must match the request host.
// On multi-subdomain setups (admin.prince-v.com + prince-v.com), we
// override NEXTAUTH_URL per-request using the x-forwarded-host header
// so NextAuth validates CSRF/callbacks against the correct origin.
function makeHandler(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-host');
  const host = forwarded ?? req.headers.get('host') ?? '';
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const origin = `${proto}://${host.split(',')[0]!.trim()}`;

  // Temporarily override NEXTAUTH_URL for this request so NextAuth
  // validates the callback URL against the correct subdomain.
  if ((origin && !origin.includes('localhost')) || process.env.AUTH_TRUST_HOST === 'true') {
    process.env.NEXTAUTH_URL = origin;
  }

  return NextAuth({
    ...authOptions,
    ...(process.env.AUTH_TRUST_HOST === 'true' ? { trustHost: true } : {})
  });
}

export async function GET(req: NextRequest, ctx: { params: { nextauth: string[] } }) {
  return makeHandler(req)(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: { nextauth: string[] } }) {
  return makeHandler(req)(req, ctx);
}
