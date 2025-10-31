// src/app/api/admin/orders/[id]/tags/[slug]/route.ts
import { prisma } from '@/lib/prisma';
import { getParams } from '@/lib/route-ctx';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(_req: NextRequest, _ctx: unknown) {
  try {
    const { id, slug: rawSlug } = getParams<{ id: string; slug: string }>(_ctx);
    const slug = decodeURIComponent(rawSlug);

    const tag = await prisma.tag.findUnique({ where: { slug } });
    if (!tag) {
      // Nothing to delete — still OK
      return NextResponse.json({ ok: true });
    }

    await prisma.orderTag.deleteMany({
      where: { orderId: id, tagId: tag.id }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE order tag failed:', error);
    return NextResponse.json({ ok: false, error: 'DELETE_TAG_FAILED' }, { status: 500 });
  }
}
