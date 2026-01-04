import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

type ResolveAction = 'CONTACTED_COURIER' | 'RECHECKED_TRACKING' | 'RESHIP' | 'REFUND' | 'IGNORE';

function actionLabel(action: ResolveAction) {
  switch (action) {
    case 'CONTACTED_COURIER':
      return 'Contacted courier';
    case 'RECHECKED_TRACKING':
      return 'Rechecked tracking';
    case 'RESHIP':
      return 'Reship';
    case 'REFUND':
      return 'Refund';
    case 'IGNORE':
      return 'Ignore';
  }
}

function actionTag(action: ResolveAction) {
  // Keep slugs stable + simple
  switch (action) {
    case 'CONTACTED_COURIER':
      return {
        slug: 'resolved-contacted-courier',
        label: 'Resolved: contacted courier',
        color: '#3b82f6'
      };
    case 'RECHECKED_TRACKING':
      return {
        slug: 'resolved-rechecked-tracking',
        label: 'Resolved: rechecked tracking',
        color: '#8b5cf6'
      };
    case 'RESHIP':
      return { slug: 'resolved-reship', label: 'Resolved: reship', color: '#f59e0b' };
    case 'REFUND':
      return { slug: 'resolved-refund', label: 'Resolved: refund', color: '#ef4444' };
    case 'IGNORE':
      return { slug: 'resolved-ignore', label: 'Resolved: ignore', color: '#94a3b8' };
  }
}

function isResolveAction(v: unknown): v is ResolveAction {
  return (
    v === 'CONTACTED_COURIER' ||
    v === 'RECHECKED_TRACKING' ||
    v === 'RESHIP' ||
    v === 'REFUND' ||
    v === 'IGNORE'
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      orderId?: unknown;
      action?: unknown;
      note?: unknown;
      addTag?: unknown;
    } | null;

    const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
    const action = body?.action;
    const note = typeof body?.note === 'string' ? body.note.trim() : '';
    const addTag = typeof body?.addTag === 'boolean' ? body.addTag : true;

    if (!orderId) {
      return NextResponse.json({ ok: false, error: 'Missing orderId' }, { status: 400 });
    }
    if (!isResolveAction(action)) {
      return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
    }

    // Ensure order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, displayId: true }
    });

    if (!order) {
      return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });
    }

    // 1) Create an order activity note (audit trail)
    const label = actionLabel(action);
    const text = note ? `${label} — ${note}` : label;

    await prisma.orderActivity.create({
      data: {
        orderId,
        type: 'NOTE',
        note: text,
        meta: {
          kind: 'EXCEPTION_RESOLVE',
          action,
          at: new Date().toISOString()
        }
      }
    });

    // 2) Optionally tag the order (for filtering + ops visibility)
    if (addTag) {
      const tagDef = actionTag(action);

      const tag = await prisma.tag.upsert({
        where: { slug: tagDef.slug },
        update: {
          label: tagDef.label,
          color: tagDef.color
        },
        create: {
          slug: tagDef.slug,
          label: tagDef.label,
          color: tagDef.color
        }
      });

      await prisma.orderTag
        .create({
          data: {
            orderId,
            tagId: tag.id
          }
        })
        .catch(() => {
          // ignore duplicates (composite PK prevents dupes)
        });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
