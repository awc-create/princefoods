// src/app/api/admin/settings/orders/route.ts
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET -> { cancelReversalMinutes: number }
export async function GET() {
  const doc = await prisma.policyDoc.findUnique({
    where: { slug: 'order-settings' },
    select: { body: true }
  });

  let minutes = 1440; // default 24h
  if (doc?.body) {
    try {
      const parsed = JSON.parse(doc.body as unknown as string);
      const n = Number(parsed?.cancelReversalMinutes);
      if (Number.isFinite(n) && n > 0) minutes = Math.floor(n);
    } catch {
      // ignore malformed
    }
  }

  return NextResponse.json({ cancelReversalMinutes: minutes });
}

// POST -> accepts either cancelReversalMinutes (preferred) or reversalWindowMinutes (legacy)
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    cancelReversalMinutes?: number | string | null;
    reversalWindowMinutes?: number | string | null; // legacy
  };

  const raw = body.cancelReversalMinutes ?? body.reversalWindowMinutes ?? null;

  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 40320) {
    return NextResponse.json({ ok: false, error: 'Invalid minutes' }, { status: 400 });
  }

  const value = Math.floor(n);
  const payload = JSON.stringify({ cancelReversalMinutes: value });

  await prisma.policyDoc.upsert({
    where: { slug: 'order-settings' },
    update: { title: 'Order Settings', body: payload },
    create: { slug: 'order-settings', title: 'Order Settings', body: payload }
  });

  return NextResponse.json({ ok: true, cancelReversalMinutes: value });
}
