// src/app/api/admin/offers/[id]/route.ts
import { deleteOffer, getOfferById, updateOffer } from '@/lib/offers-store';
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

function getIdFromReq(req: Request): string | null {
  try {
    const { pathname } = new URL(req.url);
    const parts = pathname.split('/').filter(Boolean);
    const id = parts[parts.length - 1] ?? null;
    return id && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    await requireAdmin();

    const id = getIdFromReq(req);
    if (!id) return NextResponse.json({ error: 'BAD_ID' }, { status: 400 });

    const offer = await getOfferById(id);
    if (!offer) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    return NextResponse.json({ offer });
  } catch (e) {
    return authFail(e);
  }
}

export async function PUT(req: Request) {
  try {
    await requireAdmin();

    const id = getIdFromReq(req);
    if (!id) return NextResponse.json({ error: 'BAD_ID' }, { status: 400 });

    const body = (await req.json()) as OfferAdminForm;
    const offer = await updateOffer(id, body);

    return NextResponse.json({ offer });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'BAD_REQUEST';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin();

    const id = getIdFromReq(req);
    if (!id) return NextResponse.json({ error: 'BAD_ID' }, { status: 400 });

    await deleteOffer(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authFail(e);
  }
}
