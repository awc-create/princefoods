import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const status = url.searchParams.get('status') ?? 'all';
    const issueType = url.searchParams.get('issueType') ?? 'all';
    const q = (url.searchParams.get('q') ?? '').trim();

    const where: Record<string, unknown> = {};
    if (status !== 'all') where.status = status;
    if (issueType !== 'all') where.issueType = issueType;

    if (q) {
      where.OR = [
        { order: { is: { id: { contains: q, mode: 'insensitive' } } } },
        { order: { is: { displayId: { contains: q, mode: 'insensitive' } } } },
        { order: { is: { contactEmail: { contains: q, mode: 'insensitive' } } } }
      ];
    }

    const items = await prisma.returnCase.findMany({
      where,
      orderBy: { detectedAt: 'desc' },
      include: {
        order: { select: { id: true, displayId: true, contactEmail: true, status: true } },
        shipment: { select: { id: true, trackingNumber: true, waybill: true, status: true } }
      }
    });

    return NextResponse.json({ ok: true, items });
  } catch (e) {
    console.error('GET /api/admin/returns failed', e);
    return NextResponse.json({ ok: false, error: 'RETURNS_LIST_FAILED' }, { status: 500 });
  }
}
