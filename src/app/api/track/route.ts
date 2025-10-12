import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

type Event =
  | { type: 'product_view'; productId: string }
  | { type: 'product_click'; productId: string }
  | { type: 'order_line'; productId: string; qty: number; unitPricePence: number };

export async function POST(req: NextRequest) {
  try {
    const events = (await req.json()) as Event[] | Event;
    const list: Event[] = Array.isArray(events) ? events : [events];

    const now = new Date();
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    for (const e of list) {
      switch (e.type) {
        case 'product_view': {
          await prisma.product.update({
            where: { id: e.productId },
            data: { views: { increment: 1 } }
          });
          await prisma.productDailyStat.upsert({
            where: { productId_day: { productId: e.productId, day } },
            update: { views: { increment: 1 } },
            create: { productId: e.productId, day, views: 1 }
          });
          break;
        }
        case 'product_click': {
          await prisma.product.update({
            where: { id: e.productId },
            data: { clicks: { increment: 1 } }
          });
          await prisma.productDailyStat.upsert({
            where: { productId_day: { productId: e.productId, day } },
            update: { clicks: { increment: 1 } },
            create: { productId: e.productId, day, clicks: 1 }
          });
          break;
        }
        case 'order_line': {
          const revenue = e.qty * e.unitPricePence;
          await prisma.product.update({
            where: { id: e.productId },
            data: { unitsSold: { increment: e.qty }, revenuePence: { increment: revenue } }
          });
          await prisma.productDailyStat.upsert({
            where: { productId_day: { productId: e.productId, day } },
            update: { unitsSold: { increment: e.qty }, revenuePence: { increment: revenue } },
            create: { productId: e.productId, day, unitsSold: e.qty, revenuePence: revenue }
          });
          break;
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/track] error', err);
    return NextResponse.json({ ok: false, error: 'bad request' }, { status: 400 });
  }
}
