// src/app/api/admin/orders/[id]/activity/route.ts
import { prisma } from '@/lib/prisma';
import { getParams } from '@/lib/route-ctx';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Fetch all activity logs for an order */
export async function GET(_req: NextRequest, _ctx: unknown) {
  try {
    const { id } = getParams<{ id: string }>(_ctx);
    const items = await prisma.orderActivity.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'asc' }
    });
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error('GET /activity failed:', error);
    return NextResponse.json({ ok: false, error: 'ACTIVITY_FETCH_FAILED' }, { status: 500 });
  }
}

/** Add a new manual note */
export async function POST(req: NextRequest, _ctx: unknown) {
  try {
    const { id } = getParams<{ id: string }>(_ctx);
    const body = (await req.json()) as { note?: string; type?: 'NOTE' };

    const note = (body?.note ?? '').trim().slice(0, 2000);
    if (!note) {
      return NextResponse.json({ ok: false, error: 'EMPTY_NOTE' }, { status: 400 });
    }

    const item = await prisma.orderActivity.create({
      data: {
        orderId: id,
        type: body?.type ?? 'NOTE',
        note
      }
    });

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    console.error('POST /activity failed:', error);
    return NextResponse.json({ ok: false, error: 'ACTIVITY_CREATE_FAILED' }, { status: 500 });
  }
}

/** Delete a manual note only (type === 'NOTE') */
export async function DELETE(req: NextRequest, _ctx: unknown) {
  try {
    const { id } = getParams<{ id: string }>(_ctx);
    const { searchParams } = new URL(req.url);
    const noteId = searchParams.get('noteId');

    if (!noteId) {
      return NextResponse.json({ ok: false, error: 'NOTE_ID_REQUIRED' }, { status: 400 });
    }

    const existing = await prisma.orderActivity.findUnique({ where: { id: noteId } });
    if (!existing || existing.orderId !== id) {
      return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    }

    if (existing.type !== 'NOTE') {
      return NextResponse.json({ ok: false, error: 'CANNOT_DELETE_SYSTEM_NOTE' }, { status: 403 });
    }

    await prisma.orderActivity.delete({ where: { id: noteId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /activity failed:', error);
    return NextResponse.json({ ok: false, error: 'ACTIVITY_DELETE_FAILED' }, { status: 500 });
  }
}
