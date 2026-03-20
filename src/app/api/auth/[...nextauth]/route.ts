// src/app/api/auth/[...nextauth]/route.ts
import { authOptions } from '@/lib/auth-options';
import NextAuth from 'next-auth';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getHandler(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-host');
  const host = forwarded ?? req.headers.get('host') ?? '';
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const origin = `${proto}://${host.split(',')[0]!.trim()}`;

  if (origin && (!origin.includes('localhost') || process.env.AUTH_TRUST_HOST === 'true')) {
    process.env.NEXTAUTH_URL = origin;
  }

  return NextAuth({ ...authOptions });
}

export function GET(req: NextRequest) {
  return getHandler(req)(req, {} as never);
}

export function POST(req: NextRequest) {
  return getHandler(req)(req, {} as never);
}
