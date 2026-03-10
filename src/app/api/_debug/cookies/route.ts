// src/app/api/_debug/cookies/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return NextResponse.json({
    ok: true,
    host: req.headers.get('host'),
    xForwardedHost: req.headers.get('x-forwarded-host'),
    cookieHeader: req.headers.get('cookie') ?? null
  });
}
