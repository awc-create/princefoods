// src/app/api/admin/orders/[id]/tags/route.ts
import { prisma } from '@/lib/prisma';
import { getParams } from '@/lib/route-ctx';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Fetch tags for an order */
export async function GET(_req: NextRequest, _ctx: unknown) {
  try {
    const { id } = getParams<{ id: string }>(_ctx);

    const rows = await prisma.orderTag.findMany({
      where: { orderId: id },
      include: { tag: true },
      orderBy: { assignedAt: 'asc' }
    });

    return NextResponse.json({
      ok: true,
      tags: rows.map((r) => r.tag)
    });
  } catch (error) {
    console.error('GET /tags failed', error);
    return NextResponse.json({ ok: false, error: 'TAGS_FETCH_FAILED' }, { status: 500 });
  }
}

/** Add a tag (creates tag if missing by slug) */
export async function POST(req: NextRequest, _ctx: unknown) {
  try {
    const { id } = getParams<{ id: string }>(_ctx);
    const { slug, label, color } = (await req.json()) as {
      slug: string;
      label?: string;
      color?: string;
    };

    const safeSlug = slug.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 64);
    if (!safeSlug) {
      return NextResponse.json({ ok: false, error: 'BAD_SLUG' }, { status: 400 });
    }

    const tag = await prisma.tag.upsert({
      where: { slug: safeSlug },
      create: { slug: safeSlug, label: label ?? slug, color },
      update: {}
    });

    await prisma.orderTag.upsert({
      where: { orderId_tagId: { orderId: id, tagId: tag.id } },
      create: { orderId: id, tagId: tag.id },
      update: {}
    });

    return NextResponse.json({ ok: true, tag });
  } catch (error) {
    console.error('POST /tags failed', error);
    return NextResponse.json({ ok: false, error: 'TAG_CREATE_FAILED' }, { status: 500 });
  }
}
