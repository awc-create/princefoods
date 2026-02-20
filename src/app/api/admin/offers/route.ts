// src/app/api/admin/offers/route.ts
import { createOffer, getOffers } from '@/lib/offers-store';
import { requireAdmin } from '@/lib/route-ctx';
import type { OfferAdminForm } from '@/types/offers';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authFail(e: unknown) {
  const msg = e instanceof Error ? e.message : 'UNAUTHENTICATED';
  const status = msg === 'FORBIDDEN' ? 403 : 401;
  return NextResponse.json({ error: msg }, { status });
}

export async function GET() {
  try {
    await requireAdmin();
    const offers = await getOffers();
    return NextResponse.json({ offers });
  } catch (e) {
    return authFail(e);
  }
}
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json()) as OfferAdminForm;
    const offer = await createOffer(body);
    return NextResponse.json({ offer });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'BAD_REQUEST';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
