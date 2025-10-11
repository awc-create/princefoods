import { prisma } from '@/lib/prisma';
import { urlFrom } from '@/lib/url';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = urlFrom(req.url);
    const limitRaw = searchParams.get('limit');
    const limit = Math.max(1, Math.min(50, Number(limitRaw ?? 10) || 10));

    const rows = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return NextResponse.json(
      {
        ok: true,
        data: rows.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          link: n.link,
          readAt: n.readAt?.toISOString() ?? null,
          createdAt: n.createdAt.toISOString()
        }))
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('GET /api/admin/notifications failed:', err);
    return NextResponse.json({ ok: false, error: 'LIST_FAILED' }, { status: 500 });
  }
}
